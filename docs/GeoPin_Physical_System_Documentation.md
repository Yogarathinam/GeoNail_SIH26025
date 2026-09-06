# GeoPin Physical System & CAD Prototype Documentation
**Project Title**: SIH GeoPin / LithoPin 3D Visualizer & Physical Subterranean Rock Anchor System  
**Document Version**: 2.4.0  
**Classification**: Engineering CAD Specification & Mechanical Kinematics Guide  

---

## 1. System Overview & Engineering Purpose

The **GeoPin (LithoPin) Subterranean Rock Anchor System** is a heavy-duty, two-stage captive bayonet and lead-screw driven geotechnical rock anchor engineered for deep underground mining, tunnel reinforcement, and open-pit slope stabilization. 

The system combines **pneumatic impact pile-driving capability**, a **two-stage captive bayonet locking cap**, an **internal Acme lead-screw drive**, and a **dual-opposed rotary lock conical spike anchor** capable of expanding into subterranean bedrock.

```
                   ┌──────────────────────────────────────┐
                   │   HARDENED IMPACT STRIKE CAP (STEEL) │  Y = +8.40
                   └──────────────────┬───────────────────┘
                                      │
                   ┌──────────────────┴───────────────────┐
                   │    OUTER TOP CAP SHELL (58 mm OD)    │  Y = +2.02
                   └──────────────────┬───────────────────┘
                                      │
                   ┌──────────────────┴───────────────────┐
                   │   MAIN STRUCTURAL SHAFT TUBE (18.0u) │  Y = -3.00
                   └──────────────────┬───────────────────┘
                                      │
                   ┌──────────────────┴───────────────────┐
                   │ PIECE 1: FLAT-TIP CONICAL ROCK SHOE  │  Y = -13.25
                   └──────────────────┬───────────────────┘
                                      │
                   ┌──────────────────┴───────────────────┐
                   │ PIECE 2: SHARP CONICAL SPIKE ANCHOR  │  Y = -16.25 -> -18.00
                   └──────────────────────────────────────┘
```

---

## 2. Full Component Breakdown & CAD Architecture

### 2.1 Top Cap & Strike Assembly
1. **Hardened Steel Strike Disk (`strike_cap_steel`)**:
   - **Material**: AISI 4340 High-Tensile Alloy Steel (Hardened HRC 58-62).
   - **Dimensions**: 42 mm Outer Diameter ($\varnothing$), Height = 0.30 units (15 mm thickness).
   - **Mounting Position**: Top rim of the cap at global $Y = +8.40$.
   - **Function**: Receives direct pneumatic hammer impact force during initial subterranean pile driving.

2. **Outer Top Cap Shell (`top_cap`)**:
   - **Material**: Machined Anodized Heavy Industrial Alloy Steel.
   - **Dimensions**: 58 mm Outer Diameter ($\varnothing$), 46 mm Inner Diameter ($\varnothing$), Total Height = 12.45 units (6 mm solid wall thickness).
   - **Internal Bulkheads**:
     - **CD Bulkhead Plate 1**: Positioned at local $Y = +0.80$. Partition between Chamber 1 (Locking) and Chamber 2 (Screw Drive).
     - **CD Bulkhead Plate 2**: Positioned at local $Y = +4.50$. Partition between Chamber 2 (Screw Drive) and Chamber 3 (Telemetry Electronics).
   - **Tactile Grip Ribs**: 16 heavy vertical ribs spaced evenly around the 12.45 height for manual and automated torque application.

---

### 2.2 Main Shaft Assembly
1. **Main Structural Shaft Tube (`main_shaft`)**:
   - **Material**: Structural Chromoly Steel Tube (Wall Thickness = 1.55 units / 15.5 mm).
   - **Dimensions**: 44 mm Outer Diameter ($\varnothing$), 18.0 units total length ($Y = +6.00$ to $Y = -12.00$), Central Bore Diameter = 13 mm ($\varnothing$).
   - **Machined Channel Topology**:
     - **Level 1 Circular Channel (`cap_level_1_locking_groove`)**: 360° circular track at $Y = +4.80$ to $+5.20$.
     - **Vertical Entry Slots (`cap_vertical_entry_slots`)**: Opposed slots at 0° (OPEN) and 180°.
     - **Level 2 Captive Circular Groove (`cap_level_2_captive_groove`)**: 360° captive track at $Y = +3.60$ to $+4.05$.
     - **Yellow Vertical Transfer Slot (`cap_yellow_transfer_slots`)**: 0.6-unit vertical channel connecting Level 1 to Level 2.
     - **Level 2 Transfer Exit Port & Safety Gate (`level_2_transfer_port_gate`)**: Spring-loaded stainless steel plunger that blocks unauthorized upward egress from Level 2 back into Level 1.

2. **Shaft Lock Pins (`shaft_lock_pin_left`, `shaft_lock_pin_right`)**:
   - **Material**: Stainless Steel 316.
   - **Dimensions**: Dual-opposed pins protruding 3 mm ($\varnothing = 0.40$ units, Length = 0.60 units).
   - **Position**: Located at 0° and 180° near shaft top rim ($Y = +5.60$).

---

### 2.3 Internal Lead-Screw Drive Shaft
1. **Central Threaded Screw-Drive Rod (`threaded_screw_rod`)**:
   - **Material**: Hardened Stainless Acme Threaded Steel Shaft.
   - **Dimensions**: Extended 27.0 units length ($\varnothing = 9.0$ mm core), 58 stacked Acme torus thread coils.
   - **Hard-Stop Coupling Head**: Blue Hex Socket Drive Coupling Head (`#0284c7`, $\varnothing = 11.0$ mm) that stops DEAD at CD Bulkhead Plate 1 ($Y = +0.80$).
   - **Function**: Converts continuous 360° rotation of the top cap in Level 2 into linear downward thrust (18.5 N/mm thrust constant).

---

### 2.4 Subterranean Footing & Anchor Assembly

```
  Top View: Piece 2 Machine Grooves

       Groove 1 (135°)          Groove 2 (45°)
           [●] ╲              ╱ [●]
                ╲            ╱
                 ╲   ◯      ╱
                 ╱   ▲     ╲
                ╱  Tab A/B  ╲
               ╱             ╲
           [●] ╱              ╲ [●]
       Groove 3 (225°)          Groove 4 (315°)
```

1. **Piece 1: Flat-Tip Conical Rock Shoe Footing (`bottom_conical_shoe`)**:
   - **Material**: Heavy Cast Steel Rock Shoe.
   - **Dimensions**: Truncated Cone Frustum ($r_{\text{top}} = 2.20$, $r_{\text{bottom}} = 1.10$, Height = 2.50 units). Mounted from $Y = -12.00$ to $Y = -14.50$.
   - **Central Bore**: 13 mm ($\varnothing = 0.65$ units) clearance bore for passage of the extended threaded rod.

2. **Piece 2: Sharp Conical Spike Anchor (`conical_spike_anchor`)**:
   - **Material**: Hardened Carbide-Tipped Subterranean Anchor Cone.
   - **Dimensions**: Sharp Cone ($r_{\text{top}} = 1.10$, $r_{\text{bottom}} = 0.08$ sharp tip, Height = 3.50 units).
   - **Flat Top Face Machining**:
     - **4 Separate Closed-Ended Diagonal Grooves**:
       - `lock_groove_1`: Upper-Left channel (135°) ending in deep rounded lock pocket `[●]`.
       - `lock_groove_2`: Upper-Right channel (45°) ending in deep rounded lock pocket `[●]`.
       - `lock_groove_3`: Lower-Left channel (225°) ending in deep rounded lock pocket `[●]`.
       - `lock_groove_4`: Lower-Right channel (315°) ending in deep rounded lock pocket `[●]`.
     - **Central Circular Clearance Zone ($\bigcirc$)**: $r = 0.50$ units isolation circle around central axis.

3. **Integrated Rotary Drive Plate with Dual Opposed Tabs (`rotary_drive_plate_with_opposed_tabs`)**:
   - **Material**: Precision CNC Machined Blue Anodized Steel (`#0284c7`).
   - **Mounting**: Directly integrated onto the bottom tip of the central extended threaded rod.
   - **Followers**: Features $180^\circ$ opposed followers (**Tab A** and **Tab B**).

---

## 3. Operational Kinematics & Workflows

### 3.1 Attachment Kinematics (5 Phases)

| Phase | Kinematic Movement | Mechanical State |
| :--- | :--- | :--- |
| **Step 0** | Floating Mid-Air Separation ($Y = +13.0$) | Unattached / Inspection View |
| **Step 1** | Align Cap to 0° OPEN Alignment Mark | Zero Shaft Contact Egress Position |
| **Step 2** | Push Down 1.5 units into Level 1 Channel | Pins enter Vertical Entry Slots to Level 1 |
| **Step 3** | Rotate CW 90° along Level 1 Track | Moves to Hard-Stop Index Position |
| **Step 4** | Push Down 0.6 units through Transfer Slot | Enters Level 2 Captive Track ($Y = +3.60$) |
| **Step 5** | Infinite 360° Captive Rotation | Drives Acme Threaded Rod Downward into Bedrock |

---

### 3.2 Piece 2 Rotary Lock & Free-Fall Detachment Modes

```
+-----------------------------------------------------------------------------------+
|  MODE 1: +45° CW LOCK ENGAGED                                                     |
|  - Tab A -> Groove 2 Pocket | Tab B -> Groove 3 Pocket                            |
|  - Thread Rotation -> Drives & Rotates Whole Spike Anchor Into Bedrock            |
+-----------------------------------------------------------------------------------+
|  MODE 2: -45° CCW LOCK ENGAGED                                                    |
|  - Tab A -> Groove 1 Pocket | Tab B -> Groove 4 Pocket                            |
|  - Thread Rotation -> Drives & Rotates Whole Spike Anchor Into Bedrock            |
+-----------------------------------------------------------------------------------+
|  MODE 3: 0° NEUTRAL DISENGAGED (FREE-FALL DROP)                                   |
|  - Tabs float in Central Clearance Circle (r=0.50)                                |
|  - Spike Anchor disengages and free-falls under gravity to bedrock (Y = -18.00)  |
+-----------------------------------------------------------------------------------+
```

---

## 4. Engineering Specifications Summary

| Feature Parameter | CAD Metric / Specification |
| :--- | :--- |
| **Max Installation Depth** | 300 mm (16.0 units subterranean travel) |
| **Peak Axial Thrust** | 5,550 N at 300 mm depth |
| **Bedrock Pull-Out Resistance** | 250 kN Tensile Load Rating |
| **Hermetic Protection** | IP68 Double O-Ring Sealed Chamber |
| **Safety Egress System** | Spring-Loaded Retractable Gate Plunger |
| **Visual Guidance System** | High-Visibility 0° Triangular Engraved Marker |

---

## 5. Maintenance & Inspection Protocols

1. **Pre-Deployment Check**: Verify 0° OPEN alignment mark clarity and inspect stainless steel bayonet lock pins (`shaft_lock_pin_left`, `shaft_lock_pin_right`) for shear wear.
2. **Torque Verification**: Ensure central Acme thread is clean and lubricated with molybdenum disulfide grease.
3. **Piece 2 Pocket Audit**: Inspect lock grooves 1-4 on `conical_spike_anchor` for rock dust buildup before engaging rotary lock tabs.

---
*Documentation compiled for SIH 3D GeoPin Visualizer System.*
