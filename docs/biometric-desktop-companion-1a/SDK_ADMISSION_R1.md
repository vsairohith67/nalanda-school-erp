# R1 official SDK assessment — 2026-10-01

Authored inventory/assessment only; no vendor archive, binary, manual or sample is redistributed here. No vendor demo, installer, registration script, DLL entry point or COM component was executed. No device or school address was contacted. Live mode remains OFF; the K30 adapter still fails explicitly unavailable. Simulator results are not vendor-call test doubles or hardware results.

## Acquisition and package provenance

The live [manufacturer software page](https://esslsecurity.com/software) was revalidated on the MSI host and with web browsing. Its communication SDK links matched both URLs below. Task-owned downloads used 15-second connection / 90-second total limits, three redirects maximum and 50 MiB per archive. Both completed HTTP 200 at the original official URL; byte counts and SHA256 matched the owner's named Downloads copies exactly. The chat browser's inability to parse RAR is distinct from these successful host downloads.

| Package | Acquisition / inspection | Bytes | SHA256 |
| --- | --- | ---: | --- |
| [DeviceCommunication.rar](https://media.esslsecurity.com/media/Software/SDK/DeviceCommunication.rar) | Official download; 222 archive entries; three developer manuals and four public C# source files inspected | 4553035 | `8f1a95999cf4a1e1219bdcac48a50913e23ba336affbdb45eb6e06d027811231` |
| [DeviceCommunication-dll.rar](https://media.esslsecurity.com/media/Software/SDK/DeviceCommunication-dll.rar) | Official download; 42 entries; metadata only for eight selected x86/x64 SDK DLLs | 5152677 | `c1379d2da268b9436075b58cfb72d37ca9f68df67c91571cbd36ca0f46410fe8` |
| RFIDSdk.rar | Owner-supplied local file; 114 entries; public VB sample declares serialport.dll RFID/card APIs; no verified K30 contract | 3383634 | `ba1c0ad2fd94acd9f73bf4ae872df1e2bbae2b2ff50a334235fc42d4f3b18f8b` |
| eSSLfinger-sdk-vb-net.rar | Owner-supplied local file; 65 entries; public VB sample uses ZKFPEngX sensor/capture/enrolment APIs; no verified K30 attendance contract | 143689 | `e04b69e5d7a9cb23888ffcaad2c87a194b1ca5221f5b7438ffa2b109e7a1ad0e` |
| access-control-sdk.rar | Owner-supplied local file; partial filename inventory only (81 readable names). libarchive reports two empty/unreadable entry names, exit 1; selected extraction discarded on nonzero exit. Documentation not admitted | 7758503 | `a8dcfa1cf02bf2db08e689010b2a2823d8b93d5b172458ea0e1747fe0032985a` |
| esslsensoronline2.3.3.5_64bit.rar | Owner-supplied local file; one entry, Fingerprint Reader Driver.exe; installer not extracted/executed. Filename is not evidence of K30 SDK support | 9939329 | `e4a28952541dca69bbc432d8a5f7b211bc0b1002a52ec84629358961e7fb4809` |

Inspection used maintained Windows bsdtar/libarchive 3.8.8. Selected members were streamed to flat task-generated filenames outside tracked source, never extracted using archive-controlled paths. Absolute/drive/traversal/control-character names were rejected; listing 2 MiB/10,000 entries, per-member 20 MiB, total selected 100 MiB and bounded subprocess/deadline limits applied. PDFs were parsed as documents; PE machine, file-version resources and Authenticode status were inspected without loading the DLL. No installed-program ZIP, MDB, activation/saved-login or biometric data was opened.

The manuals identify SDK 6.2.4.1 (2012). Selected zkemkeeper.dll metadata differs by architecture:

| DLL | PE machine | File version / company metadata | SHA256 | Authenticode |
| --- | --- | --- | --- | --- |
| 32BitDll/sdk/zkemkeeper.dll | x86, 0x014c | 6,2,4,11 / ZKSoftware Inc. | `3d0dd4943dbd547784ca88b29579581764b2173d8ea3979da470b6b902653dea` | NotSigned |
| 64BitDll/sdk/zkemkeeper.dll | x64, 0x8664 | 6,2,5,0 / ZKSoftware Inc. | `d543149b666249450640b5c8e46655632a86d164012ca4a0328a5d142e1b9d6e` | NotSigned |

Both architectures' commpro.dll, zkemsdk.dll and plcommpro.dll were also NotSigned; commpro file version is 6,0,0,5, while the selected zkemsdk/plcommpro version resources do not supply a version. Version/company resources are not publisher attestation. Hash matching proves downloaded-byte identity, not a vendor-signed release. No x86 broker is justified merely by this mixed package: x64 exists, but supported dependency/firmware matching remains unverified.

## API contract: attendance-only candidate surface

Page references below are one-based PDF pages, not inferred type-library definitions. B&W_SDK_Manual.pdf (114 pages), TFT_SDK_Manual.pdf (107) and IFACE_SDK_Manual.pdf (86) describe different device families. No package literally named K30 SDK is required; none of these inspected manuals establishes this school's K30 firmware-family mapping. Public samples use COM/ActiveX wrappers, but required apartment/threading and unattended/service activation prerequisites were not established. No standalone public header/IDL/TLB was selected; COM registration scripts were not run.

| Method / contract | Documented meaning and limitation | Admission |
| --- | --- | --- |
| SetCommPassword(in long CommKey) -> VARIANT_BOOL | B&W p92, TFT p85: sets PC-side communication password for matching device connection; distinct from device-writing SetDeviceCommPwd | Candidate only; protected secret, never argv/log |
| Connect_Net(in BSTR IPAdd, in long Port) -> VARIANT_BOOL | B&W p22 / TFT p23: network connection; manual default port 4370. Device binding and actual firmware support unverified | No invocation in R1 |
| ReadGeneralLogData(in long machineNumber) / ReadAllGLogData -> VARIANT_BOOL | B&W p24 / TFT p24 / IFACE p22: copies attendance records to PC-side buffer; the two are described as equivalent | Candidate retrieval; no log-clear call |
| SSR_GetGeneralLogData(in LONG machineNumber, out BSTR userId, out LONG verificationMode, inOutMode, year, month, day, hour, minute, second, workCode) -> VARIANT_BOOL | TFT pp25–26 / IFACE pp23–24: advances through the buffer, string user ID and component timestamp, verification/state/work code. Numeric codes vary by family/multiverification; timezone is absent | Preserve opaque user ID and raw codes; timezone and mapping require admission |
| GetGeneralLogData(in long machineNumber, out long terminalNumber, userId, enrolmentMachine, verificationMode, inOutMode, year, month, day, hour, minute) | B&W pp25–26: black-and-white family, numeric user ID, minute precision. Definition prints VARIANT_BOOL while return description distinguishes success 1/end 0/negative error | Must resolve actual typelib/return semantics before adapter |
| GetLastError(out long errorCode) | B&W p102 / TFT p95 / IFACE p76: distinguishes parameter, initialization, transmission and operation failures. 0 conflates absent/repeated data; -1 indicates SDK initialization/reconnect requirement | No conversion of arbitrary false into successful end-of-buffer; retries/timeouts incomplete |
| Disconnect(void) | B&W/TFT p24, IFACE p22: disconnects and releases resources | Candidate cleanup; no device mutation required |

No durable sequence number/event identity is present in the assessed general-log method fields. Work code, user ID or same-second timestamp must not be invented into a unique sequence. Existing ambiguous-identity review remains applicable. Clock/timezone interpretation, empty-buffer versus error, reconnect safety and retrieval during active capture need vendor confirmation. Samples include EnableDevice(false), clearing, user/template and clock-related operations; their presence does not establish necessity. None is admitted to the attendance-only surface. Documented retrieval writes the PC buffer; separate ClearGLog clears the terminal and is excluded.

## Usage terms and independent outcomes

No inspected package licence/readme grants the required internal custom integration or binary redistribution rights. The manuals carry ZKSoftware copyright/all-rights-reserved language; free availability and an eTimeTrackLite application EULA would not resolve SDK rights. No vendor manual/sample/binary is published, and no proprietary implementation was decompiled.

| Classification | R1 result |
| --- | --- |
| DOWNLOAD_OR_TOOLING_UNAVAILABLE | NOT APPLICABLE to both main official archives: HTTP 200 and successful bounded inspection. APPLIES partially to optional access-control filename/extraction errors; no endless retries/mirror replacement |
| DOCUMENTATION_INCOMPLETE | OPEN: firmware-family mapping, actual typelib/COM threading/service prerequisites, end-of-buffer/error semantics, timeout/reconnect and clock/identity guarantees |
| LICENCE_CONFIRMATION_REQUIRED | OPEN: internal custom integration and private installation permission; permitted distribution/repackaging scope |
| ARCHITECTURE_OR_FIRMWARE_UNVERIFIED | OPEN: x86/x64 files exist, but exact firmware and compatible documented dependency bundle not verified |
| READY_FOR_OFFLINE_ADAPTER_IMPLEMENTATION | NOT ADMITTED until contract/family and usage terms support implementation; no guessed adapter/broker added |
| READY_FOR_LATER_CONTROLLED_HARDWARE_TEST | NOT ADMITTED; separate owner authorisation, signed package and school preflight remain required |

The owner's focused dealer/eSSL email is already sent. No duplicate request was sent. Await an explicit reply identifying: (1) which SDK/version and general-log method support the exact K30 firmware; (2) required bitness/dependencies, COM apartment and unattended service activation; (3) success/end/error, timeout/reconnect, timestamp timezone/precision and stable log identity guarantees; (4) confirmation that log retrieval preserves terminal history without disable/clear/clock/user/template calls; (5) permission for internal custom integration and exact private/public redistribution restrictions. Isolation acceptance proceeds independently of these questions.
