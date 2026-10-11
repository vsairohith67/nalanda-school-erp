using System;
using System.ComponentModel;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using System.Threading;
using System.Runtime.InteropServices;
public static class MasterWave2OwnedJob {
  private static IntPtr job = IntPtr.Zero;
  [StructLayout(LayoutKind.Sequential)] private struct BasicLimit { public long ProcessTime, JobTime; public uint Flags; public UIntPtr MinimumWorkingSet, MaximumWorkingSet; public uint ActiveLimit; public UIntPtr Affinity; public uint Priority, Scheduling; }
  [StructLayout(LayoutKind.Sequential)] private struct IoCounters { public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes; }
  [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimit { public BasicLimit Basic; public IoCounters Io; public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory; }
  [StructLayout(LayoutKind.Sequential)] private struct Accounting { public long UserTime, KernelTime, PeriodUserTime, PeriodKernelTime; public uint PageFaults, TotalProcesses, ActiveProcesses, TerminatedProcesses; }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError=true)] private static extern bool SetInformationJobObject(IntPtr handle, int informationClass, ref ExtendedLimit limits, uint length);
  [DllImport("kernel32.dll", SetLastError=true)] private static extern bool AssignProcessToJobObject(IntPtr handle, IntPtr process);
  [DllImport("kernel32.dll")] private static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll", SetLastError=true)] private static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
  [DllImport("kernel32.dll", SetLastError=true)] private static extern bool QueryInformationJobObject(IntPtr handle, int informationClass, out Accounting accounting, uint length, out uint returned);
  public static void BindCurrentProcess() {
    if (job != IntPtr.Zero) throw new InvalidOperationException("OWN_JOB_ALREADY_BOUND");
    job = CreateJobObject(IntPtr.Zero, null);
    if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
    if (!SetHandleInformation(job, 1, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
    var limits = new ExtendedLimit(); limits.Basic.Flags = 0x2000; // KILL_ON_JOB_CLOSE; no breakaway flags.
    if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimit)))) throw new Win32Exception(Marshal.GetLastWin32Error());
    if (!AssignProcessToJobObject(job, GetCurrentProcess())) throw new Win32Exception(Marshal.GetLastWin32Error());
    if (ActiveProcesses() != 1) throw new InvalidOperationException("OWN_JOB_INITIAL_MEMBERSHIP_INVALID");
    // Keep the sole, non-inheritable handle for this process's lifetime. Never
    // close it early: normal exit or owned-handle termination closes it in the OS.
  }
  public static uint ActiveProcesses() {
    if (job == IntPtr.Zero) throw new InvalidOperationException("OWN_JOB_NOT_BOUND");
    Accounting accounting; uint returned;
    if (!QueryInformationJobObject(job, 1, out accounting, (uint)Marshal.SizeOf(typeof(Accounting)), out returned) || returned != Marshal.SizeOf(typeof(Accounting))) throw new Win32Exception(Marshal.GetLastWin32Error());
    return accounting.ActiveProcesses;
  }

  [DllImport("kernel32.dll", SetLastError=true, EntryPoint="QueryInformationJobObject")] private static extern bool QueryProcessIds(IntPtr handle, int cls, IntPtr buffer, uint size, out uint returned);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool IsProcessInJob(IntPtr process,IntPtr jobHandle,out bool result);
  private static Thread captureThread; private static volatile bool captureStop; private static volatile bool captureFailed;
  public static void StartOwnedCapture(string file) {
    if(job==IntPtr.Zero||captureThread!=null) throw new InvalidOperationException("OWN_JOB_CAPTURE_UNAVAILABLE");
    var stream=new FileStream(file,FileMode.CreateNew,FileAccess.Write,FileShare.Read);
    var writer=new StreamWriter(stream); writer.AutoFlush=true;
    captureThread=new Thread(()=>{
      var seen=new HashSet<string>(); var buffer=Marshal.AllocHGlobal(32776);
      try {
        while(!captureStop) {
          uint returned; if(!QueryProcessIds(job,3,buffer,32776,out returned)) throw new Win32Exception(Marshal.GetLastWin32Error());
          var count=Marshal.ReadInt32(buffer,4); if(count<0||count>4096) throw new InvalidOperationException("OWN_JOB_CAPTURE_BOUND_EXCEEDED");
          for(int i=0;i<count;i++) {
            int pid=checked((int)Marshal.ReadInt64(buffer,8+i*8));
            try { using(var proc=Process.GetProcessById(pid)) {
              bool belongs; if(!IsProcessInJob(proc.Handle,job,out belongs)||!belongs) throw new InvalidOperationException("PID_NO_LONGER_OWNED");
              var created=proc.StartTime.ToUniversalTime(); var key=pid+":"+created.Ticks;
              if(seen.Count>=32768) throw new IOException("OWNED_COHORT_BOUND_EXCEEDED");
              if(seen.Add(key)) writer.WriteLine(pid+"\t"+created.ToString("o")+"\t"+proc.ProcessName);
            }} catch(ArgumentException) {} catch(InvalidOperationException) {}
          }
          Thread.Sleep(25);
        }
      } catch(Exception) { captureFailed=true; }
      finally { Marshal.FreeHGlobal(buffer); writer.Dispose(); }
    });
    captureThread.IsBackground=true; captureThread.Start();
  }
  public static bool StopOwnedCapture() {
    if(captureThread==null) throw new InvalidOperationException("OWN_JOB_CAPTURE_NOT_STARTED");
    captureStop=true; if(!captureThread.Join(2000)) captureFailed=true;
    return !captureFailed;
  }
}
