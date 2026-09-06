# GeoNail Component Architecture & Kinematic Motion Matrix

## 1. Directory Structure

```
e:/SIH/
├── docs/
│   ├── GeoNail_Physical_System_Documentation.md
│   └── Component_Architecture_and_Kinematics.md
└── sih-3d-visualizer/
    ├── src/
    ├── components/
    │   ├── LithoPinAssembly.tsx      # Main 3D CAD Component & Kinematics Engine
    │   ├── CanvasViewport.tsx        # Three.js Viewport & Lighting Setup
    │   ├── HUDOverlay.tsx            # Floating Control Deck & Inspector UI
    │   ├── UndergroundShaft.tsx      # Subterranean Mine Shaft Environment
    │   ├── MiningEnvironment.tsx     # Open-Pit Terrain & Geology Renderer
    │   └── SunSkyEnvironment.tsx     # Dynamic Lighting & Sky Preset Engine
    └── App.tsx                       # Main Application State & Layout Host
```

---

## 2. Comprehensive CAD Element Registry

| Element ID | CAD Component Name | Dimensions ($\varnothing \times \text{H}$) | Sub-System | Primary Function |
| :--- | :--- | :--- | :--- | :--- |
| `strike_cap_steel` | Hardened Impact Strike Disk | $42\text{ mm} \times 15\text{ mm}$ | Top Impact | Absorbs pneumatic pile-driver force |
| `top_cap` | Outer Top Cap Shell | $58\text{ mm} \times 12.45\text{ u}$ | Cap Housing | Houses multi-chamber bayonet & drive |
| `main_shaft` | Main Shaft Outer Tube | $44\text{ mm} \times 18.0\text{ u}$ | Structural Core | Houses Level 1/2 channels & entry slots |
| `shaft_lock_pin_left` | Left Lock Pin (0°) | $4\text{ mm} \times 6\text{ mm}$ | Bayonet Lock | Engages cap bayonet channels |
| `shaft_lock_pin_right`| Right Lock Pin (180°) | $4\text{ mm} \times 6\text{ mm}$ | Bayonet Lock | Engages cap bayonet channels |
| `cap_level_1_locking_groove` | Level 1 Circular Channel | $58\text{ mm} \times 4\text{ mm}$ | Bayonet Track | First-stage rotational index track |
| `cap_vertical_entry_slots` | Vertical Entry Slots | $5\text{ mm} \times 15\text{ mm}$ | Egress Channel | Initial axial entry channel |
| `cap_yellow_transfer_slots` | Transfer Slot | $5\text{ mm} \times 6\text{ mm}$ | Egress Channel | Connects Level 1 to Level 2 |
| `cap_level_2_captive_groove`| Level 2 Captive Track | $58\text{ mm} \times 4.5\text{ mm}$ | Captive Drive | 360° infinite captive rotation track |
| `level_2_transfer_port_gate`| Retractable Safety Plunger| $5\text{ mm} \times 3\text{ mm}$ | Safety Egress | Retracts only at 0° OPEN position |
| `open_alignment_mark` | 0° Shaft Base Marker | $6\text{ mm Triangle}$ | Visual Guide | Indicates exact 0° alignment |
| `threaded_screw_rod` | Central Acme Screw Rod | $9\text{ mm} \times 27.0\text{ u}$ | Drive Actuator | Converts cap rotation into axial thrust |
| `bottom_conical_shoe` | Piece 1: Rock Shoe Footing | $44\text{ mm} \times 2.5\text{ u}$ | Footing | Bottom shaft rock shoe mounting |
| `conical_spike_anchor` | Piece 2: Sharp Spike Anchor | $22\text{ mm} \times 3.5\text{ u}$ | Subterranean | Sharp carbide anchor cone in bedrock |
| `lock_groove_1` | Lock Groove 1 (135°) | $18\text{ mm} \times 4.5\text{ mm}$ | Rotary Lock | Upper-Left lock pocket |
| `lock_groove_2` | Lock Groove 2 (45°) | $18\text{ mm} \times 4.5\text{ mm}$ | Rotary Lock | Upper-Right lock pocket |
| `lock_groove_3` | Lock Groove 3 (225°) | $18\text{ mm} \times 4.5\text{ mm}$ | Rotary Lock | Lower-Left lock pocket |
| `lock_groove_4` | Lock Groove 4 (315°) | $18\text{ mm} \times 4.5\text{ mm}$ | Rotary Lock | Lower-Right lock pocket |
| `rotary_drive_plate_with_opposed_tabs` | Rotary Drive Crossbar | $30\text{ mm} \times 1.5\text{ u}$ | Drive Tip | Integrated drive head on thread tip |

---

## 3. Mathematical Kinematic Models

### 3.1 Downward Screw-Drive Translation Equation
$$\Delta Y_{\text{thread}} = \max\left(-3.40, \, \min\left(0.0, \, -\theta_{\text{cap}} \times 0.54\right)\right)$$

### 3.2 Piece 2 Vertical Position Equation
$$Y_{\text{spike}} = \begin{cases} 
-18.00 + Y_{\text{exploded}} & \text{if } \text{isFreeFalling (0° Neutral Detached)} \\
-16.25 + Y_{\text{exploded}} + \Delta Y_{\text{thread}} & \text{if } \text{isSpikeLocked (±45° Locked)}
\end{cases}$$

### 3.3 Piece 2 Angular Rotation Equation
$$\theta_{\text{spike}} = \begin{cases} 
0 & \text{if disengaged (0° Neutral)} \\
\theta_{\text{cap}} + \theta_{\text{lock}} & \text{if locked (±45° CW/CCW)}
\end{cases}$$

---
*Documentation generated for SIH GeoNail Visualizer System.*
