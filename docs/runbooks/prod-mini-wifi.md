# prod-mini WiFi (MT7902)

**Host:** `prod-mini` / `aerekos-server` · **Goal:** run the control plane on WLAN so the router Ethernet port is optional.

## Hardware

| Item | Value |
|------|--------|
| Chipset | MediaTek MT7902 (Filogic 310) |
| PCI ID | `14c3:7902` |
| Interface | `wlp1s0` |
| Driver | **`mt7902e`** (DKMS) — in-tree only from Linux **7.1+** |
| Firmware | `mediatek/WIFI_MT7902_*` (+ BT `BT_RAM_CODE_MT7902_*` via installer) |
| Kernel tested | Ubuntu 24.04 HWE `7.0.0-42-generic` |

Stock `mt7921e` / `mt7925e` **do not** bind `14c3:7902` on 7.0 (`new_id` → EINVAL).

## Install (already done once)

Source used: [abdullaabdullazade/mt7902_driver](https://github.com/abdullaabdullazade/mt7902_driver)

```bash
# on laptop: fetch zip, rsync tree to prod-mini, then:
cd ~/mt7902_driver
sudo ./install.sh --no-reboot
# reboot when convenient; WiFi often works before reboot once module is loaded
```

On 7.1+ kernels, prefer distro `linux-firmware` + in-tree driver and remove DKMS (`sudo ./uninstall.sh` from that repo).

## NetworkManager profile

| Connection | Role |
|------------|------|
| **NSA-Van** (`wlp1s0`) | Primary · autoconnect · priority 200 · **static `192.168.0.141/24`** · GW `192.168.0.1` |
| **Profile 1** (`enp2s0`) | Ethernet **fallback only** · `autoconnect no` |

SSH host `prod-mini` stays `192.168.0.141`.

```bash
nmcli device status
nmcli connection show NSA-Van
sudo nmcli connection up NSA-Van
# optional ethernet:
sudo nmcli connection up "Profile 1"
```

## Autoload

`/etc/modules-load.d/mt7902e.conf` contains `mt7902e`.

## Recovery if WiFi dies after kernel upgrade

1. Plug Ethernet, `sudo nmcli connection up "Profile 1"` (may need DHCP).
2. `dkms status` — rebuild or re-run `install.sh` for the new kernel headers.
3. Or upgrade to kernel **≥ 7.1** and uninstall the out-of-tree driver.

## Safety

Do not `docker compose down` or wipe volumes while fixing network. Keepers unchanged.
