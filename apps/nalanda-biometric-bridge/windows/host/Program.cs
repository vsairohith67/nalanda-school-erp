using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Nalanda.Biometric;

try
{
    if (!OperatingSystem.IsWindows()) throw new InvalidOperationException("HOST_WINDOWS_REQUIRED");
    if (args.Length != 2 || !new[] { "--service", "--console", "--provision", "--validate", "--resume" }.Contains(args[0])) throw new InvalidOperationException("HOST_ARGUMENTS_INVALID");
    if (args[0] == "--provision")
    {
        // Management provisions through stdin. No credential is accepted on a command line.
        var file = Path.GetFullPath(args[1]);
        if (File.Exists(file)) throw new InvalidOperationException("HOST_SECRET_ALREADY_EXISTS");
        var input = await Console.In.ReadLineAsync() ?? throw new InvalidOperationException("HOST_SECRET_REQUIRED");
        if (input.Length > 16384) throw new InvalidOperationException("HOST_SECRET_INVALID");
        SecretStore.Validate(input);
        var plain = Encoding.UTF8.GetBytes(input);
        try
        {
            var protectedBytes = ProtectedData.Protect(plain, SecretStore.Entropy, DataProtectionScope.LocalMachine);
            using var output = new FileStream(file, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            output.Write(protectedBytes); output.Flush(true);
        }
        finally { CryptographicOperations.ZeroMemory(plain); }
        Console.WriteLine("HOST_SECRET_PROVISIONED_ACL_REVIEW_REQUIRED");
        return 0;
    }
    var configPath = Path.GetFullPath(args[1]);
    var settings = HostSettings.Load(configPath);
    if (args[0] == "--validate") { Console.WriteLine("HOST_CONFIG_VALID"); return 0; }
    if (args[0] == "--resume")
    {
        using var child = OwnedProcess.Start(settings, true);
        using var timeout = new CancellationTokenSource(30000);
        await child.Input.WriteLineAsync(SecretStore.Load(settings.SecretPath)); await child.Input.FlushAsync();
        if (await child.Output.ReadLineAsync(timeout.Token) != "READY" || await child.Output.ReadLineAsync(timeout.Token) != "RESUMED") throw new InvalidOperationException();
        await child.WaitAsync(timeout.Token);
        if (child.ExitCode != 0) throw new InvalidOperationException();
        Console.WriteLine("HOST_HELD_BATCH_RESUMED_NO_DATA_DELETED"); return 0;
    }
    var builder = Host.CreateApplicationBuilder(Array.Empty<string>());
    builder.Logging.ClearProviders(); // No child payloads or sensitive exception text in logs.
    builder.Services.AddSingleton(settings);
    builder.Services.AddSingleton(new HostLocation(configPath));
    if (args[0] == "--service") builder.Services.AddWindowsService(o => o.ServiceName = settings.ServiceName);
    builder.Services.Configure<HostOptions>(o => o.ShutdownTimeout = TimeSpan.FromMilliseconds(settings.StopMs + 5000));
    builder.Services.AddHostedService<Supervisor>();
    using var host = builder.Build();
    if (args[0] == "--console")
    {
        var lifetime = host.Services.GetRequiredService<IHostApplicationLifetime>();
        _ = Task.Run(async () => { while (await Console.In.ReadLineAsync() is { } line) if (line == "STOP") { lifetime.StopApplication(); break; } });
    }
    await host.RunAsync();
    return Environment.ExitCode;
}
catch { Console.Error.WriteLine("HOST_FAILED_CLOSED"); return 1; }

namespace Nalanda.Biometric
{
    public sealed record HostLocation(string ConfigPath);
    public sealed record HostSettings(string ServiceName, string NodeExe, string AgentPath, string BridgeConfig, string SecretPath, string WorkingDirectory, string NodeSha256, string AgentSha256, int StartupMs = 10000, int StopMs = 10000, int MaxRestarts = 3)
    {
        public static HostSettings Load(string file)
        {
            if (new FileInfo(file).Length > 16384) throw new InvalidOperationException();
            var s = JsonSerializer.Deserialize<HostSettings>(File.ReadAllText(file), new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? throw new InvalidOperationException();
            if (!System.Text.RegularExpressions.Regex.IsMatch(s.ServiceName, "^NalandaBiometric[A-Za-z0-9_-]{1,48}$") || s.StartupMs is < 1000 or > 30000 || s.StopMs is < 1000 or > 30000 || s.MaxRestarts is < 0 or > 5) throw new InvalidOperationException();
            foreach (var p in new[] { s.NodeExe, s.AgentPath, s.BridgeConfig, s.SecretPath, s.WorkingDirectory })
                if (!Path.IsPathFullyQualified(p) || p.StartsWith("\\\\") || p.Any(c => c == '"' || char.IsControl(c)) || (File.GetAttributes(p) & FileAttributes.ReparsePoint) != 0) throw new InvalidOperationException();
            if (!Directory.Exists(s.WorkingDirectory) || !string.Equals(Path.GetDirectoryName(s.AgentPath), s.WorkingDirectory, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException();
            VerifyHash(s.NodeExe, s.NodeSha256); VerifyHash(s.AgentPath, s.AgentSha256);
            return s;
        }
        static void VerifyHash(string file, string hash)
        {
            if (!System.Text.RegularExpressions.Regex.IsMatch(hash, "^[a-fA-F0-9]{64}$") || !Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(file))).Equals(hash, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("HOST_PROVENANCE_FAILED");
        }
    }
    public static class SecretStore
    {
        public static readonly byte[] Entropy = Encoding.UTF8.GetBytes("nalanda-biometric-local-secret-v1");
        public static string Load(string file)
        {
            if (new FileInfo(file).Length > 32768) throw new InvalidOperationException();
            var plain = ProtectedData.Unprotect(File.ReadAllBytes(file), Entropy, DataProtectionScope.LocalMachine);
            try { var json = Encoding.UTF8.GetString(plain); Validate(json); return json; }
            finally { CryptographicOperations.ZeroMemory(plain); }
        }
        public static void Validate(string json)
        {
            using var d = JsonDocument.Parse(json); var root = d.RootElement;
            var encoded = root.GetProperty("queueKey").GetString()!;
            var padded = encoded.Replace('-', '+').Replace('_', '/') + new string('=', (4 - encoded.Length % 4) % 4);
            if (Convert.FromBase64String(padded).Length != 32 || root.GetProperty("keyVersion").GetInt32() < 1) throw new InvalidOperationException();
            if (root.TryGetProperty("signingKey", out var key) && (key.GetProperty("kty").GetString() != "OKP" || key.GetProperty("crv").GetString() != "Ed25519" || !key.TryGetProperty("d", out _))) throw new InvalidOperationException();
            if (root.EnumerateObject().Any(p => !new[] { "queueKey", "keyVersion", "signingKey" }.Contains(p.Name))) throw new InvalidOperationException();
        }
    }
    public sealed class Supervisor(HostSettings settings, HostLocation location, IHostApplicationLifetime lifetime) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                using var bridge = JsonDocument.Parse(File.ReadAllText(settings.BridgeConfig));
                var queuePath = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(settings.BridgeConfig)!, bridge.RootElement.GetProperty("queuePath").GetString()!));
                var configRoot = Path.GetDirectoryName(settings.BridgeConfig)! + Path.DirectorySeparatorChar;
                if (!queuePath.StartsWith(configRoot, StringComparison.OrdinalIgnoreCase) || Path.GetDirectoryName(queuePath) == Path.GetDirectoryName(settings.BridgeConfig)) throw new InvalidOperationException("HOST_RUNTIME_PATH_INVALID");
                Directory.CreateDirectory(Path.GetDirectoryName(queuePath)!);
                using var ownership = new FileStream(queuePath + ".host.lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
                for (var restart = 0; restart <= settings.MaxRestarts && !stoppingToken.IsCancellationRequested; restart++)
                {
                    HostSettings.Load(location.ConfigPath);
                    using var child = OwnedProcess.Start(settings);
                    try
                    {
                        await child.Input.WriteLineAsync(SecretStore.Load(settings.SecretPath)); await child.Input.FlushAsync();
                        using var startup = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken); startup.CancelAfter(settings.StartupMs);
                        if (await child.Output.ReadLineAsync(startup.Token) != "READY") throw new InvalidOperationException("HOST_CHILD_STARTUP_FAILED");
                        Console.WriteLine("HOST_CHILD_READY");
                        // Bounded output is ignored. The worker only emits startup readiness and safe codes.
                        await child.WaitAsync(stoppingToken);
                        if (!stoppingToken.IsCancellationRequested) Console.WriteLine("HOST_CHILD_EXITED");
                    }
                    finally
                    {
                        try { await child.Input.WriteLineAsync("STOP"); await child.Input.FlushAsync(); } catch { }
                        using var stop = new CancellationTokenSource(settings.StopMs);
                        try { await child.WaitAsync(stop.Token); } catch { child.Terminate(); }
                    }
                    if (!stoppingToken.IsCancellationRequested && restart < settings.MaxRestarts) await Task.Delay(TimeSpan.FromSeconds(Math.Min(30, 2 << restart)), stoppingToken);
                }
                if (!stoppingToken.IsCancellationRequested) { Environment.ExitCode = 1; Console.Error.WriteLine("HOST_RESTART_LIMIT"); lifetime.StopApplication(); }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch { Environment.ExitCode = 1; Console.Error.WriteLine("HOST_SUPERVISOR_FAILED_CLOSED"); lifetime.StopApplication(); }
        }
    }
}
