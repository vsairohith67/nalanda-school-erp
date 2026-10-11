using System.ComponentModel;
using System.Diagnostics;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;

namespace Nalanda.Biometric;

/// <summary>Suspended creation closes the assign-to-job race. Job closure kills all owned descendants.</summary>
public sealed class OwnedProcess : IDisposable
{
    IntPtr job, processHandle;
    readonly Process process;
    readonly AnonymousPipeServerStream inputPipe, outputPipe;
    public StreamWriter Input { get; }
    public StreamReader Output { get; }
    OwnedProcess(IntPtr job, IntPtr handle, int pid, AnonymousPipeServerStream input, AnonymousPipeServerStream output)
    {
        this.job = job; processHandle = handle; process = Process.GetProcessById(pid); inputPipe = input; outputPipe = output;
        Input = new StreamWriter(input, new UTF8Encoding(false)) { AutoFlush = true }; Output = new StreamReader(output, Encoding.UTF8);
    }
    public int ExitCode => process.ExitCode;
    public static OwnedProcess Start(HostSettings settings, bool resumeHeld = false)
    {
        var job = CreateJobObject(IntPtr.Zero, null); if (job == IntPtr.Zero) throw new Win32Exception();
        var limits = new JobLimits(); limits.Basic.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        var size = Marshal.SizeOf<JobLimits>(); var buffer = Marshal.AllocHGlobal(size);
        AnonymousPipeServerStream? input = null, output = null; ProcessInfo pi = default;
        try
        {
            Marshal.StructureToPtr(limits, buffer, false); Check(SetInformationJobObject(job, 9, buffer, (uint)size));
            input = new AnonymousPipeServerStream(PipeDirection.Out, HandleInheritability.Inheritable);
            output = new AnonymousPipeServerStream(PipeDirection.In, HandleInheritability.Inheritable);
            var si = new StartupInfo { cb = Marshal.SizeOf<StartupInfo>(), flags = 0x100, stdin = input.ClientSafePipeHandle.DangerousGetHandle(), stdout = output.ClientSafePipeHandle.DangerousGetHandle(), stderr = output.ClientSafePipeHandle.DangerousGetHandle() };
            // No inherited NODE_OPTIONS, NODE_PATH, secrets, or writable PATH injection.
            var environment = $"NODE_ENV=production\0SystemRoot={Environment.GetFolderPath(Environment.SpecialFolder.Windows)}\0\0";
            var env = Marshal.StringToHGlobalUni(environment);
            try
            {
                var command = new StringBuilder($"\"{settings.NodeExe}\" \"{settings.AgentPath}\" --supervised --config \"{settings.BridgeConfig}\"{(resumeHeld ? " --resume-held-batch" : "")}");
                Check(CreateProcess(settings.NodeExe, command, IntPtr.Zero, IntPtr.Zero, true, 0x4 | 0x400 | 0x08000000, env, settings.WorkingDirectory, ref si, out pi));
            }
            finally { Marshal.FreeHGlobal(env); }
            Check(AssignProcessToJobObject(job, pi.process));
            input.DisposeLocalCopyOfClientHandle(); output.DisposeLocalCopyOfClientHandle();
            if (ResumeThread(pi.thread) == uint.MaxValue) throw new Win32Exception();
            CloseHandle(pi.thread); pi.thread = IntPtr.Zero;
            return new OwnedProcess(job, pi.process, (int)pi.pid, input, output);
        }
        catch
        {
            if (pi.process != IntPtr.Zero) { TerminateProcess(pi.process, 1); CloseHandle(pi.process); }
            if (pi.thread != IntPtr.Zero) CloseHandle(pi.thread);
            CloseHandle(job); input?.Dispose(); output?.Dispose(); throw;
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }
    public Task WaitAsync(CancellationToken token) => process.WaitForExitAsync(token);
    public void Terminate() { if (job != IntPtr.Zero) { Check(TerminateJobObject(job, 1)); } }
    public void Dispose()
    {
        // Close job before releasing pipes, even when the supervisor is unwinding an exception.
        if (job != IntPtr.Zero) { CloseHandle(job); job = IntPtr.Zero; }
        if (processHandle != IntPtr.Zero) { CloseHandle(processHandle); processHandle = IntPtr.Zero; }
        // Broken stdin is expected after a child crash. Ownership cleanup has already happened.
        try { Input.Dispose(); } catch (IOException) { }
        try { Output.Dispose(); } catch (IOException) { }
        inputPipe.Dispose(); outputPipe.Dispose(); process.Dispose();
    }
    static void Check(bool result) { if (!result) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits { public long processTime, jobTime; public uint LimitFlags; public UIntPtr minWorking, maxWorking; public uint activeLimit; public UIntPtr affinity; public uint priority, scheduling; }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong r1, r2, r3, r4, r5, r6; }
    [StructLayout(LayoutKind.Sequential)] struct JobLimits { public BasicLimits Basic; public IoCounters io; public UIntPtr processMemory, jobMemory, peakProcess, peakJob; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct StartupInfo { public int cb; public string? reserved, desktop, title; public int x, y, xSize, ySize, xCount, yCount, fill; public uint flags; public short show, reserved2; public IntPtr bytes, stdin, stdout, stderr; }
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process, thread; public uint pid, tid; }
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode, EntryPoint = "CreateProcessW")] static extern bool CreateProcess(string app, StringBuilder command, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref StartupInfo si, out ProcessInfo pi);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attributes, string? name);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetInformationJobObject(IntPtr job, int kind, IntPtr info, uint size);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool TerminateJobObject(IntPtr job, uint code);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool TerminateProcess(IntPtr process, uint code);
    [DllImport("kernel32.dll", SetLastError = true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool CloseHandle(IntPtr handle);
}
