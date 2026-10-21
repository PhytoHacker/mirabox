using System;
using System.Collections.Generic;
using System.Management;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;

public class DdcWorker {
  const int InternalPanel = 11;

  delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdc, IntPtr rect, IntPtr data);

  [StructLayout(LayoutKind.Sequential)]
  struct RECT {
    public int left, top, right, bottom;
  }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  struct MONITORINFOEX {
    public int cbSize;
    public RECT rcMonitor;
    public RECT rcWork;
    public uint dwFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
    public string szDevice;
  }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  struct DISPLAY_DEVICE {
    public int cb;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
    public string DeviceName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
    public string DeviceString;
    public uint StateFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
    public string DeviceID;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
    public string DeviceKey;
  }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  struct PHYSICAL_MONITOR {
    public IntPtr hPhysicalMonitor;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
    public string szPhysicalMonitorDescription;
  }

  [DllImport("user32.dll")]
  static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc proc, IntPtr data);

  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFOEX info);

  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  static extern bool EnumDisplayDevices(string device, uint devNum, ref DISPLAY_DEVICE dd, uint flags);

  [DllImport("dxva2.dll", SetLastError = true)]
  static extern bool GetNumberOfPhysicalMonitorsFromHMONITOR(IntPtr hMonitor, out uint count);

  [DllImport("dxva2.dll", EntryPoint = "GetPhysicalMonitorsFromHMONITOR", CharSet = CharSet.Auto, SetLastError = true)]
  static extern bool GetPhysicalMonitorsFromHMONITOR(IntPtr hMonitor, uint count, [Out] PHYSICAL_MONITOR[] monitors);

  [DllImport("dxva2.dll", SetLastError = true)]
  static extern bool DestroyPhysicalMonitors(uint count, [In] PHYSICAL_MONITOR[] monitors);

  [DllImport("dxva2.dll", SetLastError = true)]
  static extern bool GetMonitorBrightness(IntPtr hMonitor, out uint min, out uint current, out uint max);

  [DllImport("dxva2.dll", SetLastError = true)]
  static extern bool SetMonitorBrightness(IntPtr hMonitor, uint value);

  [DllImport("dxva2.dll", SetLastError = true)]
  static extern bool GetVCPFeatureAndVCPFeatureReply(IntPtr hMonitor, byte code, out uint type, out uint current, out uint max);

  [DllImport("dxva2.dll", SetLastError = true)]
  static extern bool SetVCPFeature(IntPtr hMonitor, byte code, uint value);

  const uint QueryActivePaths = 2;

  [StructLayout(LayoutKind.Sequential)]
  struct LUID { public uint LowPart; public int HighPart; }

  [StructLayout(LayoutKind.Sequential)]
  struct DISPLAYCONFIG_RATIONAL { public uint Numerator; public uint Denominator; }

  [StructLayout(LayoutKind.Sequential)]
  struct DISPLAYCONFIG_PATH_SOURCE_INFO {
    public LUID adapterId;
    public uint id;
    public uint modeInfoIdx;
    public uint statusFlags;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct DISPLAYCONFIG_PATH_TARGET_INFO {
    public LUID adapterId;
    public uint id;
    public uint modeInfoIdx;
    public uint outputTechnology;
    public uint rotation;
    public uint scaling;
    public DISPLAYCONFIG_RATIONAL refreshRate;
    public uint scanLineOrdering;
    public bool targetAvailable;
    public uint statusFlags;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct DISPLAYCONFIG_PATH_INFO {
    public DISPLAYCONFIG_PATH_SOURCE_INFO sourceInfo;
    public DISPLAYCONFIG_PATH_TARGET_INFO targetInfo;
    public uint flags;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct DISPLAYCONFIG_MODE_INFO {
    public uint infoType;
    public uint id;
    public LUID adapterId;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 64)]
    public byte[] rest;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct DISPLAYCONFIG_DEVICE_INFO_HEADER {
    public int type;
    public int size;
    public LUID adapterId;
    public uint id;
  }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct DISPLAYCONFIG_TARGET_DEVICE_NAME {
    public DISPLAYCONFIG_DEVICE_INFO_HEADER header;
    public uint flags;
    public uint outputTechnology;
    public ushort edidManufactureId;
    public ushort edidProductCodeId;
    public uint connectorInstance;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
    public string monitorFriendlyDeviceName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
    public string monitorDevicePath;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct ADVANCED_COLOR {
    public DISPLAYCONFIG_DEVICE_INFO_HEADER header;
    public uint value;
    public uint colorEncoding;
    public uint bitsPerColorChannel;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct SDR_WHITE {
    public DISPLAYCONFIG_DEVICE_INFO_HEADER header;
    public uint SDRWhiteLevel;
  }

  [StructLayout(LayoutKind.Sequential, Pack = 4)]
  struct SDR_WHITE_SET {
    public DISPLAYCONFIG_DEVICE_INFO_HEADER header;
    public uint SDRWhiteLevel;
    public byte finalValue;
  }

  [DllImport("user32.dll")]
  static extern int GetDisplayConfigBufferSizes(uint flags, out uint pathCount, out uint modeCount);

  [DllImport("user32.dll")]
  static extern int QueryDisplayConfig(uint flags, ref uint pathCount, [Out] DISPLAYCONFIG_PATH_INFO[] paths, ref uint modeCount, [Out] DISPLAYCONFIG_MODE_INFO[] modes, IntPtr topology);

  [DllImport("user32.dll")]
  static extern int DisplayConfigGetDeviceInfo(ref DISPLAYCONFIG_TARGET_DEVICE_NAME info);

  [DllImport("user32.dll")]
  static extern int DisplayConfigGetDeviceInfo(ref ADVANCED_COLOR info);

  [DllImport("user32.dll")]
  static extern int DisplayConfigGetDeviceInfo(ref SDR_WHITE info);

  [DllImport("user32.dll")]
  static extern int DisplayConfigSetDeviceInfo(ref SDR_WHITE_SET info);

  class Panel {
    public string Name;
    public int Tech = -1;
  }

  class Screen {
    public string Id;
    public string Name;
    public string Kind = "ddc";
    public bool Primary;
    public uint Min;
    public uint Current;
    public uint Max;
    public IntPtr Handle;
    public PHYSICAL_MONITOR[] Owned;
  }

  static int Main() {
    Console.InputEncoding = Encoding.UTF8;
    Console.OutputEncoding = new UTF8Encoding(false);
    var writer = new System.IO.StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false));
    writer.AutoFlush = true;
    Console.SetOut(writer);
    var serializer = new JavaScriptSerializer();
    string line;
    while ((line = Console.ReadLine()) != null) {
      if (line.Trim().Length == 0) continue;
      Dictionary<string, object> reply;
      try {
        var message = serializer.Deserialize<Dictionary<string, object>>(line);
        var command = message != null && message.ContainsKey("cmd") ? Convert.ToString(message["cmd"]) : "";
        if (command == "list") reply = List();
        else if (command == "set") reply = Set(Convert.ToString(message["id"]), Convert.ToInt32(message["value"]));
        else reply = Fail("unknown command");
      } catch (Exception error) {
        reply = Fail(error.Message);
      }
      Console.Out.WriteLine(serializer.Serialize(reply));
    }
    return 0;
  }

  static Dictionary<string, object> List() {
    var screens = Scan();
    try {
      var monitors = new List<Dictionary<string, object>>();
      foreach (var screen in screens) {
        monitors.Add(new Dictionary<string, object> {
          { "id", screen.Id },
          { "name", screen.Name },
          { "primary", screen.Primary },
          { "hdr", screen.Kind == "hdr" },
          { "brightness", (int)screen.Current },
          { "min", (int)screen.Min },
          { "max", (int)screen.Max }
        });
      }
      return new Dictionary<string, object> {
        { "ok", true },
        { "monitors", monitors }
      };
    } finally {
      Release(screens);
    }
  }

  static Dictionary<string, object> Set(string id, int requested) {
    var screens = Scan();
    try {
      Screen screen = null;
      foreach (var item in screens) {
        if (item.Id == id) screen = item;
      }
      if (screen == null) return Fail("monitor not found");
      var value = (uint)Math.Max(screen.Min, Math.Min(screen.Max, requested));
      uint current;
      if (screen.Kind == "wmi") {
        if (!SetLaptop((int)value)) return Fail("laptop rejected brightness");
        current = (uint)ReadLaptop();
      } else if (screen.Kind == "hdr") {
        if (!SetHdr(screen.Name, (int)value, out current)) return Fail("hdr rejected brightness");
      } else if (!WriteDdc(screen.Handle, value, out current)) {
        return Fail("monitor rejected brightness");
      }
      return new Dictionary<string, object> {
        { "ok", true },
        { "id", screen.Id },
        { "brightness", (int)current }
      };
    } finally {
      Release(screens);
    }
  }

  static List<Screen> Scan() {
    var known = LoadPanels();
    var hdr = LoadHdr();
    var found = new List<Screen>();
    MonitorEnumProc callback = (hMonitor, hdc, rect, data) => {
      var info = new MONITORINFOEX();
      info.cbSize = Marshal.SizeOf(typeof(MONITORINFOEX));
      if (!GetMonitorInfo(hMonitor, ref info)) return true;
      var device = new DISPLAY_DEVICE();
      device.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
      if (!EnumDisplayDevices(info.szDevice, 0, ref device, 1)) return true;
      var id = KeyFromDeviceId(device.DeviceID);
      if (id.Length == 0) return true;
      Panel panel;
      known.TryGetValue(id, out panel);
      if (panel != null && panel.Tech == InternalPanel) return true;
      var name = panel != null && !string.IsNullOrEmpty(panel.Name) ? panel.Name : id.Split('\\')[0];
      int hdrPercent;
      if (hdr.TryGetValue(name, out hdrPercent)) {
        found.Add(new Screen {
          Id = id,
          Name = name,
          Kind = "hdr",
          Primary = (info.dwFlags & 1) != 0,
          Min = 0,
          Current = (uint)hdrPercent,
          Max = 100
        });
        return true;
      }
      uint count;
      if (!GetNumberOfPhysicalMonitorsFromHMONITOR(hMonitor, out count) || count == 0) return true;
      var physical = new PHYSICAL_MONITOR[count];
      if (!GetPhysicalMonitorsFromHMONITOR(hMonitor, count, physical)) return true;
      uint min, current, max;
      if (!ReadBrightness(physical[0].hPhysicalMonitor, out min, out current, out max)) {
        DestroyPhysicalMonitors(count, physical);
        return true;
      }
      found.Add(new Screen {
        Id = id,
        Name = name,
        Primary = (info.dwFlags & 1) != 0,
        Min = min,
        Current = current,
        Max = max,
        Handle = physical[0].hPhysicalMonitor,
        Owned = physical
      });
      return true;
    };
    EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, callback, IntPtr.Zero);
    GC.KeepAlive(callback);
    AddLaptop(found, known);
    return found;
  }

  static bool WriteDdc(IntPtr handle, uint value, out uint current) {
    uint min, max;
    var wrote = SetMonitorBrightness(handle, value);
    var read = ReadBrightness(handle, out min, out current, out max);
    if (wrote && read && current == value) return true;
    if (!SetVCPFeature(handle, 0x10, value)) return wrote && read;
    return ReadBrightness(handle, out min, out current, out max) || wrote;
  }

  static bool ReadBrightness(IntPtr handle, out uint min, out uint current, out uint max) {
    if (GetMonitorBrightness(handle, out min, out current, out max)) return true;
    uint type;
    min = 0;
    return GetVCPFeatureAndVCPFeatureReply(handle, 0x10, out type, out current, out max);
  }

  static void Release(List<Screen> screens) {
    foreach (var screen in screens) {
      if (screen.Owned != null) DestroyPhysicalMonitors((uint)screen.Owned.Length, screen.Owned);
    }
  }

  static Dictionary<string, Panel> LoadPanels() {
    var panels = new Dictionary<string, Panel>();
    using (var searcher = new ManagementObjectSearcher(@"root\wmi", "SELECT * FROM WmiMonitorID"))
    using (var result = searcher.Get()) {
      foreach (ManagementObject item in result) {
        using (item) {
          var id = KeyFromWmi(Convert.ToString(item["InstanceName"]));
          if (id.Length == 0) continue;
          Panel panel;
          if (!panels.TryGetValue(id, out panel)) {
            panel = new Panel();
            panels[id] = panel;
          }
          panel.Name = Decode(item["UserFriendlyName"]);
        }
      }
    }
    using (var searcher = new ManagementObjectSearcher(@"root\wmi", "SELECT * FROM WmiMonitorConnectionParams"))
    using (var result = searcher.Get()) {
      foreach (ManagementObject item in result) {
        using (item) {
          var id = KeyFromWmi(Convert.ToString(item["InstanceName"]));
          if (id.Length == 0) continue;
          Panel panel;
          if (!panels.TryGetValue(id, out panel)) {
            panel = new Panel();
            panels[id] = panel;
          }
          panel.Tech = Convert.ToInt32(item["VideoOutputTechnology"]);
        }
      }
    }
    return panels;
  }

  static string Decode(object value) {
    if (value == null) return "";
    var chars = value as ushort[];
    if (chars != null) {
      var text = new StringBuilder();
      foreach (var ch in chars) {
        if (ch == 0) break;
        text.Append((char)ch);
      }
      return text.ToString().Trim();
    }
    var bytes = value as byte[];
    if (bytes == null) return "";
    var length = bytes.Length;
    while (length > 0 && bytes[length - 1] == 0) length--;
    return Encoding.Unicode.GetString(bytes, 0, length).Trim();
  }

  static string KeyFromWmi(string instance) {
    if (string.IsNullOrEmpty(instance)) return "";
    var slash = instance.IndexOf('\\');
    var key = slash >= 0 ? instance.Substring(slash + 1) : instance;
    if (key.EndsWith("_0")) key = key.Substring(0, key.Length - 2);
    return key;
  }

  static string KeyFromDeviceId(string deviceId) {
    if (string.IsNullOrEmpty(deviceId)) return "";
    var marker = deviceId.IndexOf('#');
    if (marker < 0) return "";
    var key = deviceId.Substring(marker + 1).Replace('#', '\\');
    var guid = key.IndexOf("\\{");
    if (guid >= 0) key = key.Substring(0, guid);
    return key;
  }

  static void AddLaptop(List<Screen> found, Dictionary<string, Panel> known) {
    using (var searcher = new ManagementObjectSearcher(@"root\wmi", "SELECT * FROM WmiMonitorBrightness"))
    using (var result = searcher.Get()) {
      foreach (ManagementObject item in result) {
        using (item) {
          if (!Convert.ToBoolean(item["Active"])) continue;
          var id = KeyFromWmi(Convert.ToString(item["InstanceName"]));
          Panel panel;
          known.TryGetValue(id, out panel);
          if (panel == null || panel.Tech != InternalPanel) continue;
          found.Add(new Screen {
            Id = "wmi:" + id,
            Name = "Ноутбук",
            Kind = "wmi",
            Min = 0,
            Current = (uint)Convert.ToInt32(item["CurrentBrightness"]),
            Max = 100
          });
        }
      }
    }
  }

  static bool SetLaptop(int percent) {
    using (var searcher = new ManagementObjectSearcher(@"root\wmi", "SELECT * FROM WmiMonitorBrightnessMethods"))
    using (var result = searcher.Get()) {
      foreach (ManagementObject item in result) {
        using (item) {
          var input = item.GetMethodParameters("WmiSetBrightness");
          input["Timeout"] = (uint)1;
          input["Brightness"] = (byte)Math.Max(0, Math.Min(100, percent));
          item.InvokeMethod("WmiSetBrightness", input, null);
          return true;
        }
      }
    }
    return false;
  }

  static int ReadLaptop() {
    using (var searcher = new ManagementObjectSearcher(@"root\wmi", "SELECT * FROM WmiMonitorBrightness"))
    using (var result = searcher.Get()) {
      foreach (ManagementObject item in result) {
        using (item) {
          if (!Convert.ToBoolean(item["Active"])) continue;
          return Convert.ToInt32(item["CurrentBrightness"]);
        }
      }
    }
    return 0;
  }

  static bool QueryPaths(out DISPLAYCONFIG_PATH_INFO[] paths) {
    paths = new DISPLAYCONFIG_PATH_INFO[0];
    uint pathCount, modeCount;
    if (GetDisplayConfigBufferSizes(QueryActivePaths, out pathCount, out modeCount) != 0) return false;
    paths = new DISPLAYCONFIG_PATH_INFO[pathCount];
    var modes = new DISPLAYCONFIG_MODE_INFO[modeCount];
    for (int i = 0; i < modes.Length; i++) modes[i].rest = new byte[64];
    return QueryDisplayConfig(QueryActivePaths, ref pathCount, paths, ref modeCount, modes, IntPtr.Zero) == 0;
  }

  static bool HdrPercent(DISPLAYCONFIG_PATH_INFO path, out string name, out int percent) {
    name = "";
    percent = 0;
    var target = new DISPLAYCONFIG_TARGET_DEVICE_NAME();
    target.header.type = 2;
    target.header.size = Marshal.SizeOf(typeof(DISPLAYCONFIG_TARGET_DEVICE_NAME));
    target.header.adapterId = path.targetInfo.adapterId;
    target.header.id = path.targetInfo.id;
    if (DisplayConfigGetDeviceInfo(ref target) != 0) return false;
    name = target.monitorFriendlyDeviceName ?? "";
    var color = new ADVANCED_COLOR();
    color.header.type = 9;
    color.header.size = Marshal.SizeOf(typeof(ADVANCED_COLOR));
    color.header.adapterId = path.targetInfo.adapterId;
    color.header.id = path.targetInfo.id;
    if (DisplayConfigGetDeviceInfo(ref color) != 0 || (color.value & 2) == 0) return false;
    var white = new SDR_WHITE();
    white.header.type = 11;
    white.header.size = Marshal.SizeOf(typeof(SDR_WHITE));
    white.header.adapterId = path.targetInfo.adapterId;
    white.header.id = path.targetInfo.id;
    if (DisplayConfigGetDeviceInfo(ref white) != 0) return false;
    percent = LevelToPercent(white.SDRWhiteLevel);
    return name.Length > 0;
  }

  static Dictionary<string, int> LoadHdr() {
    var levels = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
    DISPLAYCONFIG_PATH_INFO[] paths;
    if (!QueryPaths(out paths)) return levels;
    foreach (var path in paths) {
      string name;
      int percent;
      if (!HdrPercent(path, out name, out percent)) continue;
      levels[name] = percent;
    }
    return levels;
  }

  static bool SetHdr(string name, int percent, out uint current) {
    current = (uint)Math.Max(0, Math.Min(100, percent));
    DISPLAYCONFIG_PATH_INFO[] paths;
    if (!QueryPaths(out paths)) return false;
    foreach (var path in paths) {
      string target;
      int ignored;
      if (!HdrPercent(path, out target, out ignored) || !string.Equals(target, name, StringComparison.OrdinalIgnoreCase)) continue;
      var set = new SDR_WHITE_SET();
      set.header.type = unchecked((int)0xFFFFFFEE);
      set.header.size = Marshal.SizeOf(typeof(SDR_WHITE_SET));
      set.header.adapterId = path.targetInfo.adapterId;
      set.header.id = path.targetInfo.id;
      set.SDRWhiteLevel = (uint)(1000 + (int)current * 50);
      set.finalValue = 1;
      if (DisplayConfigSetDeviceInfo(ref set) != 0) return false;
      int read;
      string confirmed;
      if (HdrPercent(path, out confirmed, out read)) current = (uint)read;
      return true;
    }
    return false;
  }

  static int LevelToPercent(uint level) {
    var percent = (int)Math.Round((level - 1000) / 50.0);
    if (percent < 0) return 0;
    if (percent > 100) return 100;
    return percent;
  }

  static Dictionary<string, object> Fail(string error) {
    return new Dictionary<string, object> {
      { "ok", false },
      { "error", error }
    };
  }
}
