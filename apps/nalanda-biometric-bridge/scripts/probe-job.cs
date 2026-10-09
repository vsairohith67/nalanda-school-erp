// Disposable acceptance helper only. Gate the child until assignment closes
// the descendant race; terminate/verify the owned job before deleting its user.
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public sealed class BiometricProbeJob : IDisposable {
    IntPtr job;
    public BiometricProbeJob() {
        job=CreateJobObject(IntPtr.Zero,null);Check(job!=IntPtr.Zero);
        var limits=new Limits();limits.basic.flags=0x2000;
        var size=Marshal.SizeOf<Limits>();var p=Marshal.AllocHGlobal(size);
        try {Marshal.StructureToPtr(limits,p,false);Check(SetInformationJobObject(job,9,p,(uint)size));}
        catch {Dispose();throw;} finally {Marshal.FreeHGlobal(p);}
    }
    public void Assign(IntPtr process) {Check(AssignProcessToJobObject(job,process));}
    public void Terminate() {Check(TerminateJobObject(job,1));}
    public uint ActiveProcesses {get {Accounting a;Check(QueryInformationJobObject(job,1,out a,(uint)Marshal.SizeOf<Accounting>(),IntPtr.Zero));return a.active;}}
    public void Dispose() {if(job!=IntPtr.Zero){Check(CloseHandle(job));job=IntPtr.Zero;}}
    static void Check(bool ok) {if(!ok)throw new Win32Exception(Marshal.GetLastWin32Error());}
    [StructLayout(LayoutKind.Sequential)] struct Basic {public long processTime,jobTime;public uint flags;public UIntPtr minimum,maximum;public uint active;public UIntPtr affinity;public uint priority,scheduling;}
    [StructLayout(LayoutKind.Sequential)] struct Io {public ulong a,b,c,d,e,f;}
    [StructLayout(LayoutKind.Sequential)] struct Limits {public Basic basic;public Io io;public UIntPtr processMemory,jobMemory,peakProcess,peakJob;}
    [StructLayout(LayoutKind.Sequential)] struct Accounting {public long user,kernel,periodUser,periodKernel;public uint faults,total,active,terminated;}
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,IntPtr information,uint size);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int kind,out Accounting information,uint size,IntPtr returned);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
}
