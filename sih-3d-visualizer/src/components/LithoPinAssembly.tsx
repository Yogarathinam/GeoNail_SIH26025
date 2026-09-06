import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html, PivotControls } from '@react-three/drei';

export interface LithoPinProps {
  /** Attach sequence step (0 = Unattached, 1 = Align 0°, 2 = Push 10mm, 3 = Rotate CW 90°, 4 = Drop 4mm, 5 = Captive Infinite Rotate) */
  attachStep: number;
  /** Remove sequence step (0 = Seated in Level 2, 1 = Align OPEN 0°, 2 = Gate Retracted, 3 = Pull Up 4mm, 4 = Rotate CCW 90°, 5 = Pull Up 10mm, 6 = Detached) */
  removeStep: number;
  /** Current manual / infinite rotation angle of cap in Level 2 (radians) */
  capRotationAngle: number;
  /** 0 = Assembled, 1 = Fully Exploded */
  explodedProgress: number;

  /** Cutaway / X-Ray transparency mode */
  cutawayMode: boolean;
  /** Visualize direct structural hammer force flow */
  showLoadPath: boolean;
  /** Enable 3D free drag & positioning handles */
  dragModeEnabled?: boolean;
  /** Currently selected component for inspector highlight */
  selectedComponent: string | null;
  /** Callback when user clicks a component mesh */
  onSelectComponent?: (componentName: string, title: string, details: Record<string, string>) => void;
  /** Callback when 3D drag starts/ends to pause OrbitControls */
  onDragStateChange?: (isDragging: boolean) => void;
}

export interface ComponentSpec {
  name: string;
  title: string;
  material: string;
  dimensions: string;
  functionality: string;
  ipRating: string;
  loadPath: string;
}

export const LITHO_PIN_COMPONENTS: Record<string, ComponentSpec> = {
  main_shaft: {
    name: 'main_shaft',
    title: 'Main Structural Shaft',
    material: 'Heavy-Wall Galvanized Alloy Steel Pipe (Sch 80)',
    dimensions: '44 mm Outer Ø × 3.5 mm Wall Thickness × 64 mm Visual Length',
    functionality: 'Transmits hammer impact to subterranean ground rod without bowing.',
    ipRating: 'Structural Base Shell',
    loadPath: 'PRIMARY LOAD PATH: Carries 100% of hammer installation impulse force.',
  },
  bottom_conical_shoe: {
    name: 'bottom_conical_shoe',
    title: 'Piece 1: Flat-Tip Conical Rock Shoe Footing',
    material: 'Hardened Tungsten Carbide / Alloy Steel Frustum',
    dimensions: '44 mm Top Ø × 22 mm Flat-Tip Ø × 50 mm Frustum Height',
    functionality: 'Bottom conical ground stake footing with non-sharp flat tip for subterranean penetration.',
    ipRating: 'Heavy-Duty Ground Interface Footing',
    loadPath: 'PRIMARY GROUND IMPACTION PATH: Transmits penetration force into bedrock.',
  },
  conical_spike_anchor: {
    name: 'conical_spike_anchor',
    title: 'Piece 2: Sharp Conical Spike Anchor',
    material: 'Ultra-Hardened Diamond-Coated Tungsten Spike',
    dimensions: '22 mm Top Ø × 0.5 mm Sharp Tip Ø × 70 mm Height',
    functionality: 'Subterranean rock penetrator with 4 top diagonal lock grooves for rotary tab engagement.',
    ipRating: 'Subterranean Anchoring Tip',
    loadPath: 'PENETRATION POINT: Pierces hard rock formations under rotational drive force.',
  },
  rotary_drive_plate_with_opposed_tabs: {
    name: 'rotary_drive_plate_with_opposed_tabs',
    title: 'Piece 2: Rotary Drive Plate with Opposed Tabs',
    material: 'Hardened Chrome-Moly Alloy Steel Crossbar',
    dimensions: '20 mm Outer Ø × 2 Opposed 180° Locking Tabs (Tab A & Tab B)',
    functionality: 'Rotates with central threaded rod to slide Tab A & Tab B into diagonal lock grooves.',
    ipRating: 'Rotary Cam Follower Lock',
    loadPath: 'ROTARY LOCK DRIVE: Transmits 100% of torque lock into spike pockets.',
  },
  lock_groove_1: {
    name: 'lock_groove_1',
    title: 'Lock Groove 1 (Upper-Left Diagonal)',
    material: 'Precision Machined Internal Track with End Lock Pocket',
    dimensions: '4.5 mm Width × 12 mm Diagonal Length at 135°',
    functionality: 'Engages Tab A during counter-clockwise (-45°) rotation.',
    ipRating: 'Rotary Lock Pocket',
    loadPath: 'CCW Mechanical Retention Pocket.',
  },
  lock_groove_2: {
    name: 'lock_groove_2',
    title: 'Lock Groove 2 (Upper-Right Diagonal)',
    material: 'Precision Machined Internal Track with End Lock Pocket',
    dimensions: '4.5 mm Width × 12 mm Diagonal Length at 45°',
    functionality: 'Engages Tab A during clockwise (+45°) rotation.',
    ipRating: 'Rotary Lock Pocket',
    loadPath: 'CW Mechanical Retention Pocket.',
  },
  lock_groove_3: {
    name: 'lock_groove_3',
    title: 'Lock Groove 3 (Lower-Left Diagonal)',
    material: 'Precision Machined Internal Track with End Lock Pocket',
    dimensions: '4.5 mm Width × 12 mm Diagonal Length at 225°',
    functionality: 'Engages Tab B during clockwise (+45°) rotation.',
    ipRating: 'Rotary Lock Pocket',
    loadPath: 'CW Mechanical Retention Pocket.',
  },
  lock_groove_4: {
    name: 'lock_groove_4',
    title: 'Lock Groove 4 (Lower-Right Diagonal)',
    material: 'Precision Machined Internal Track with End Lock Pocket',
    dimensions: '4.5 mm Width × 12 mm Diagonal Length at 315°',
    functionality: 'Engages Tab B during counter-clockwise (-45°) rotation.',
    ipRating: 'Rotary Lock Pocket',
    loadPath: 'CCW Mechanical Retention Pocket.',
  },


  shaft_lock_pin_left: {
    name: 'shaft_lock_pin_left',
    title: 'Shaft Lock Pin A (Left at 0°)',
    material: 'Hardened Stainless Steel Dowel Pin (316 Ti)',
    dimensions: '4 mm Ø × 3 mm Radial Protrusion at 0° (Height = +2.8)',
    functionality: 'Engages Level 1 vertical slot, 90° bayonet track, and Level 2 annular groove.',
    ipRating: 'Internal Mechanical Lock',
    loadPath: 'Axial retention & torque stop detent.',
  },
  shaft_lock_pin_right: {
    name: 'shaft_lock_pin_right',
    title: 'Shaft Lock Pin B (Right at 180°)',
    material: 'Hardened Stainless Steel Dowel Pin (316 Ti)',
    dimensions: '4 mm Ø × 3 mm Radial Protrusion at 180° (Height = +2.8)',
    functionality: 'Opposing dowel pin providing balanced dual-lug rotational and axial guidance.',
    ipRating: 'Internal Mechanical Lock',
    loadPath: 'Axial retention & torque stop detent.',
  },
  top_cap: {
    name: 'top_cap',
    title: 'Single-Piece Removable Top Cap',
    material: 'Hard-Anodized Aircraft Aluminum (Al alloy 7075-T6)',
    dimensions: '58 mm Outer Ø × 32 mm Height (16 Vertical Grip Ribs)',
    functionality: 'Single physical cap shell housing multi-level internal locking channels.',
    ipRating: 'IP67 Weatherproof Cap Shell',
    loadPath: 'ISOLATED: Protective outer actuator cap.',
  },
  cap_level_1_entry_slot_left: {
    name: 'cap_level_1_entry_slot_left',
    title: 'Level 1 Vertical Entry Slot (Left)',
    material: 'CNC Milled Internal Channel',
    dimensions: '5 mm Width × 10 mm Vertical Travel Length at 0°',
    functionality: 'Initial 10 mm downward entry path for shaft Pin A.',
    ipRating: 'Level 1 Entry Channel',
    loadPath: 'Initial insertion guidance slot.',
  },
  cap_level_1_entry_slot_right: {
    name: 'cap_level_1_entry_slot_right',
    title: 'Level 1 Vertical Entry Slot (Right)',
    material: 'CNC Milled Internal Channel',
    dimensions: '5 mm Width × 10 mm Vertical Travel Length at 180°',
    functionality: 'Initial 10 mm downward entry path for shaft Pin B.',
    ipRating: 'Level 1 Entry Channel',
    loadPath: 'Initial insertion guidance slot.',
  },
  cap_90_degree_bayonet_track_left: {
    name: 'cap_90_degree_bayonet_track_left',
    title: 'Level 1 90° Bayonet Track (Left)',
    material: 'CNC Milled Circumferential Channel',
    dimensions: '90° Clockwise Arc Index Track (0° to 90°)',
    functionality: 'Guided 90° quarter-turn rotation to Level 1 hard stop.',
    ipRating: 'Level 1 Bayonet Track',
    loadPath: 'Rotational lock indexing channel.',
  },
  cap_90_degree_bayonet_track_right: {
    name: 'cap_90_degree_bayonet_track_right',
    title: 'Level 1 90° Bayonet Track (Right)',
    material: 'CNC Milled Circumferential Channel',
    dimensions: '90° Clockwise Arc Index Track (180° to 270°)',
    functionality: 'Guided 90° quarter-turn rotation to Level 1 hard stop.',
    ipRating: 'Level 1 Bayonet Track',
    loadPath: 'Rotational lock indexing channel.',
  },
  cap_transfer_drop_left: {
    name: 'cap_transfer_drop_left',
    title: 'Level 1-to-2 Transfer Drop Channel (Left)',
    material: 'CNC Milled Vertical Transition Slot',
    dimensions: '5 mm Width × 4 mm Vertical Transition at 90° Index',
    functionality: '4 mm vertical drop path transitioning pins from Level 1 to Level 2.',
    ipRating: 'Transfer Drop Port',
    loadPath: 'Axial displacement drop channel.',
  },
  cap_transfer_drop_right: {
    name: 'cap_transfer_drop_right',
    title: 'Level 1-to-2 Transfer Drop Channel (Right)',
    material: 'CNC Milled Vertical Transition Slot',
    dimensions: '5 mm Width × 4 mm Vertical Transition at 270° Index',
    functionality: '4 mm vertical drop path transitioning pins from Level 1 to Level 2.',
    ipRating: 'Transfer Drop Port',
    loadPath: 'Axial displacement drop channel.',
  },
  cap_level_2_annular_retaining_groove: {
    name: 'cap_level_2_annular_retaining_groove',
    title: 'Level 2 Annular Retaining Groove',
    material: 'Continuous 360° Internal Circular Groove',
    dimensions: '360° Continuous Circular Channel × 4.5 mm Height',
    functionality: 'Traps cap axially while permitting unlimited 360° free rotation.',
    ipRating: 'Level 2 Captive Groove',
    loadPath: 'Axial captive retention channel.',
  },
  cap_level_2_transfer_port: {
    name: 'cap_level_2_transfer_port',
    title: 'Level 2 Transfer Port (0° OPEN Alignment)',
    material: 'Precision Vertical Exit Channel',
    dimensions: '5 mm Width × 4 mm Height at 0° OPEN Position',
    functionality: 'Single egress port connecting Level 2 back to Level 1 when removing cap.',
    ipRating: 'Transfer Exit Port',
    loadPath: 'Controlled removal egress port.',
  },
  level_2_transfer_port_gate: {
    name: 'level_2_transfer_port_gate',
    title: 'Level 2 Transfer Port Safety Gate',
    material: 'Spring-Loaded Stainless Steel Safety Plunger',
    dimensions: '5 mm Width × 3 mm Radial Extension',
    functionality: 'Normally blocks upward movement from Level 2 into transfer port. Retracts during removal sequence.',
    ipRating: 'Safety Lock Gate',
    loadPath: 'Accidental detachment prevention gate.',
  },
  open_alignment_mark: {
    name: 'open_alignment_mark',
    title: 'Fixed Shaft OPEN Alignment Mark',
    material: 'High-Visibility White Engraved Triangular Marker',
    dimensions: '6 mm Triangle Marker at 0° Shaft Base',
    functionality: 'Indicates exact 0° alignment required for release gate retraction.',
    ipRating: 'Visual Alignment Marker',
    loadPath: 'Visual positioning guide.',
  },
  threaded_screw_rod: {
    name: 'threaded_screw_rod',
    title: 'Internal Spinning Helical Screw-Drive Rod',
    material: 'High-Tensile Hardened Steel Acme Threaded Shaft',
    dimensions: '9 mm Core Ø × 16 Helical Threads × 160 mm Travel',
    functionality: 'Converts infinite Level 2 rotation into axial downward drive force into subterranean ground stake bore.',
    ipRating: 'Heavy-Duty Linear Drive Actuator',
    loadPath: 'DRIVE LOAD PATH: Generates subterranean anchoring thrust during cap rotation.',
  },
};

interface LithoPinAssemblyProps {
  attachStep: number;
  removeStep: number;
  capRotationAngle: number;
  spikeLockAngle?: number; // -Math.PI/4 (-45° CCW), 0 (Neutral), +Math.PI/4 (+45° CW)
  spikeDetached?: boolean; // Free-fall gravitational drop disengagement
  magSpikeOffset?: number; // Mag field driven axial displacement towards/away from Piece 1
  explodedProgress: number;
  cutawayMode: boolean;
  showLoadPath: boolean;
  dragModeEnabled?: boolean;
  showLabels?: boolean; // Dynamic 3D leader-line callout labels
  selectedComponent: string | null;
  onSelectComponent?: (componentName: string, title: string, details: Record<string, string>) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

export const LithoPinAssembly: React.FC<LithoPinAssemblyProps> = ({
  attachStep,
  removeStep,
  capRotationAngle,
  spikeLockAngle,
  spikeDetached = false,
  magSpikeOffset = 0,
  explodedProgress,
  cutawayMode,
  showLoadPath,
  dragModeEnabled = false,
  showLabels = false,
  selectedComponent,
  onSelectComponent,
  onDragStateChange,
}) => {


  const capGroupRef = useRef<THREE.Group>(null!);
  const gateRef = useRef<THREE.Group>(null!);
  const loadPulseRef = useRef<THREE.Group>(null!);

  const [hoveredComp, setHoveredComp] = useState<string | null>(null);

  // Exploded displacement multipliers across 6 distinct CAD tiers
  const exp = explodedProgress;
  const expY_cap = 6.5 * exp;
  const expY_shaft = 0 * exp;
  const expX_pins = 3.5 * exp;
  const expY_shoe = -8.0 * exp;
  const expY_spike = -13.0 * exp;

  // Universal Material helpers for X-Ray cutaway across ALL components
  const getMaterialProps = (compName: string, baseColor: string, metalness = 0.8, roughness = 0.3) => {
    const isSelected = selectedComponent === compName;
    const isHovered = hoveredComp === compName;

    // Universal Outer Shell Translucency in Cutaway Mode across top cap, main shaft, Piece 1 shoe, and Piece 2 spike anchor
    const isOuterShell =
      compName === 'top_cap' ||
      compName === 'main_shaft' ||
      compName === 'bottom_conical_shoe' ||
      compName === 'conical_spike_anchor';

    const isCutawayTransparent = cutawayMode && isOuterShell;

    return {
      color: isSelected ? '#0284c7' : isHovered ? '#38bdf8' : baseColor,
      metalness: isSelected || isHovered ? 0.95 : metalness,
      roughness: isSelected || isHovered ? 0.15 : roughness,
      transparent: isCutawayTransparent || isSelected || isHovered,
      opacity: isCutawayTransparent ? 0.38 : 1.0,
      emissive: isSelected
        ? new THREE.Color('#0284c7').multiplyScalar(0.45)
        : isHovered
        ? new THREE.Color('#38bdf8').multiplyScalar(0.35)
        : cutawayMode && !isOuterShell
        ? new THREE.Color('#0284c7').multiplyScalar(0.35)
        : new THREE.Color('#000000'),
      wireframe: false,
    };
  };


  // Compute Cap Target Y Position & Target Y Rotation based on Attach/Remove State Machines
  let targetY = 13.0; // Separated default in mid-air (+13.0)
  let targetRot = capRotationAngle;

  if (removeStep > 0) {
    // REMOVAL SEQUENCE STATE MACHINE (Reverse Egress Path):
    // Step 1: Rotate to 0° OPEN Alignment Mark (targetY = +6.2, Rot = 0°)
    // Step 2: Pull UP 0.6 units from Level 2 to Level 1 Track (targetY = +6.8, Rot = 0°)
    // Step 3: Rotate CCW 90° through Level 1 Track (targetY = +6.8, Rot = -90°)
    // Step 4: Pull UP through Entry Slot to Hover (targetY = +8.8, Rot = -90°)
    // Step 5: Detached / Fully Separated (targetY = +16.0, Rot = -90°)
    switch (removeStep) {
      case 1:
        targetY = 6.2;
        targetRot = 0;
        break;
      case 2:
        targetY = 6.8;
        targetRot = 0;
        break;
      case 3:
        targetY = 6.8;
        targetRot = -Math.PI / 2;
        break;
      case 4:
        targetY = 8.8;
        targetRot = -Math.PI / 2;
        break;
      case 5:
      default:
        targetY = 18.0;
        targetRot = -Math.PI / 2;
        break;
    }
  } else {
    // ATTACHMENT SEQUENCE STATE MACHINE:
    // Step 0: Completely Separated Cap & Shaft View (targetY = +18.0, Rot = 0°)
    // Step 1: Align 0° OPEN - Hover Just Above Shaft Rim (targetY = +8.8, Rot = 0°)
    // Step 2: Push down Entry Slot to Level 1 Cyan Blue Track (targetY = +6.8, Rot = 0°) -> Global Pin Y = 6.8 + (-1.2) = +5.6 EXACT MATCH!
    // Step 3: Rotate CW 90° along Level 1 Track to Hard Stop (targetY = +6.8, Rot = +90°)
    // Step 4: Push 0.6 units down Transfer Slot into Level 2 Green Groove (targetY = +6.2, Rot = +90°) -> Global Pin Y = 6.2 + (-0.6) = +5.6 EXACT MATCH!
    // Step 5: Captive Level 2 - Free Infinite 360° Spin (targetY = +6.2, Rot = capRotationAngle)
    switch (attachStep) {
      case 0:
        targetY = 18.0;
        targetRot = 0;
        break;

      case 1:
        targetY = 8.8;
        targetRot = 0;
        break;
      case 2:
        targetY = 6.8;
        targetRot = 0;
        break;
      case 3:
        targetY = 6.8;
        targetRot = Math.PI / 2;
        break;
      case 4:
        targetY = 6.2;
        targetRot = Math.PI / 2;
        break;
      case 5:
      default:
        targetY = 6.2;
        targetRot = capRotationAngle;
        break;
    }
  }

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();

    // Critically-Damped Spring Easing for silky smooth push, pull & rotational indexing
    const destinationY = targetY + expY_cap;
    if (capGroupRef.current) {
      capGroupRef.current.position.y = THREE.MathUtils.damp(
        capGroupRef.current.position.y,
        destinationY,
        4.5,
        delta
      );
      capGroupRef.current.rotation.y = THREE.MathUtils.damp(
        capGroupRef.current.rotation.y,
        targetRot,
        5.5,
        delta
      );
    }


    // Retract / Extend Spring-Loaded Release Gate during Removal
    if (gateRef.current) {
      const targetGateX = removeStep >= 2 ? 0.35 : 0.0;
      gateRef.current.position.x = THREE.MathUtils.damp(
        gateRef.current.position.x,
        targetGateX,
        10.0,
        delta
      );
    }

    // Load path pulse lines movement
    if (loadPulseRef.current) {
      loadPulseRef.current.position.y = ((elapsed * 2.5) % 3.5) - 1.5;
    }
  });

  const bindHoverEvents = (compName: string) => ({
    onPointerOver: (e: any) => {
      e.stopPropagation();
      setHoveredComp(compName);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: (e: any) => {
      e.stopPropagation();
      setHoveredComp(null);
      document.body.style.cursor = 'auto';
    },
    onClick: (e: any) => {
      e.stopPropagation();
      if (onSelectComponent) {
        const spec = LITHO_PIN_COMPONENTS[compName];
        if (spec) {
          onSelectComponent(compName, spec.title, {
            Material: spec.material,
            Dimensions: spec.dimensions,
            Function: spec.functionality,
            'IP Rating': spec.ipRating,
            'Load Path': spec.loadPath,
          });
        }
      }
    },
  });

  // Generate 16 vertical shallow grip ribs for cap
  const ribAngles = Array.from({ length: 16 }, (_, i) => (i * Math.PI * 2) / 16);

  return (
    <PivotControls
      visible={dragModeEnabled}
      scale={1.4}
      depthTest={false}
      lineWidth={3}
      anchor={[0, 0, 0]}
      axisColors={['#ef4444', '#10b981', '#0284c7']}
      onDragStart={() => onDragStateChange?.(true)}
      onDragEnd={() => onDragStateChange?.(false)}
    >
      <group position={[0, 6.5, 0]}>

        {/* Interactive Floating Hover Tooltip */}
        {hoveredComp && LITHO_PIN_COMPONENTS[hoveredComp] && (
          <Html position={[0, 5.2, 0]} center distanceFactor={14}>
            <div className="hover-tooltip">
              <div className="hover-tooltip-title">
                🔍 {LITHO_PIN_COMPONENTS[hoveredComp].title}
              </div>
              <div className="hover-tooltip-desc">
                {LITHO_PIN_COMPONENTS[hoveredComp].functionality}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', marginTop: 2, fontWeight: 600 }}>
                Rating: {LITHO_PIN_COMPONENTS[hoveredComp].ipRating}
              </div>
            </div>
          </Html>
        )}

        {/* 3D Drag Mode Active Badge Callout */}
        {dragModeEnabled && (
          <Html position={[0, 5.8, 0]} center distanceFactor={14}>
            <div className="component-tag" style={{ border: '1.5px solid #f59e0b', color: '#f59e0b' }}>
              ✋ 3D Drag Handles Active — Drag Gizmo Arrows to Position
            </div>
          </Html>
        )}

        {/* Dynamic 3D Leader-Line CAD Callout Labels */}
        {(showLabels || hoveredComp || selectedComponent) && (
          <group>
            {/* Top Cap Callout */}
            {(showLabels || hoveredComp === 'top_cap' || selectedComponent === 'top_cap') && (
              <Html position={[3.2, 4.0 + expY_cap, 0]} distanceFactor={13}>
                <div style={{ position: 'relative', pointerEvents: 'none' }}>
                  <svg style={{ position: 'absolute', top: 12, left: -60, width: 60, height: 2, overflow: 'visible' }}>
                    <line x1="0" y1="0" x2="60" y2="0" stroke="#0284c7" strokeWidth="2" strokeDasharray="3 2" />
                    <circle cx="0" cy="0" r="3" fill="#38bdf8" />
                  </svg>
                  <div className="glass-panel" style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #0284c7', background: 'rgba(15,23,42,0.92)' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8' }}>1. Top Cap Housing</div>
                    <div style={{ fontSize: '0.66rem', color: '#cbd5e1' }}>58mm OD × 12.45u Height (16 Grip Ribs)</div>
                  </div>
                </div>
              </Html>
            )}

            {/* Main Shaft Callout */}
            {(showLabels || hoveredComp === 'main_shaft' || selectedComponent === 'main_shaft') && (
              <Html position={[-3.6, -3.0 + expY_shaft, 0]} distanceFactor={13}>
                <div style={{ position: 'relative', pointerEvents: 'none' }}>
                  <svg style={{ position: 'absolute', top: 12, right: -60, width: 60, height: 2, overflow: 'visible' }}>
                    <line x1="0" y1="0" x2="60" y2="0" stroke="#0284c7" strokeWidth="2" strokeDasharray="3 2" />
                    <circle cx="60" cy="0" r="3" fill="#38bdf8" />
                  </svg>
                  <div className="glass-panel" style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #0284c7', background: 'rgba(15,23,42,0.92)' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8' }}>2. Main Structural Shaft</div>
                    <div style={{ fontSize: '0.66rem', color: '#cbd5e1' }}>44mm OD × 18.0u Length (Level 1/2 Tracks)</div>
                  </div>
                </div>
              </Html>
            )}

            {/* Central Threaded Rod Callout */}
            {(showLabels || hoveredComp === 'threaded_screw_rod' || selectedComponent === 'threaded_screw_rod') && (
              <Html position={[3.2, -6.0 + expY_shaft, 0]} distanceFactor={13}>
                <div style={{ position: 'relative', pointerEvents: 'none' }}>
                  <svg style={{ position: 'absolute', top: 12, left: -60, width: 60, height: 2, overflow: 'visible' }}>
                    <line x1="0" y1="0" x2="60" y2="0" stroke="#eab308" strokeWidth="2" strokeDasharray="3 2" />
                    <circle cx="0" cy="0" r="3" fill="#eab308" />
                  </svg>
                  <div className="glass-panel" style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #eab308', background: 'rgba(15,23,42,0.92)' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#eab308' }}>3. Acme Threaded Screw Rod</div>
                    <div style={{ fontSize: '0.66rem', color: '#cbd5e1' }}>27.0u Length (58 Acme Coils)</div>
                  </div>
                </div>
              </Html>
            )}

            {/* Piece 1 Rock Shoe Callout */}
            {(showLabels || hoveredComp === 'bottom_conical_shoe' || selectedComponent === 'bottom_conical_shoe') && (
              <Html position={[-3.6, -13.25 + expY_shoe, 0]} distanceFactor={13}>
                <div style={{ position: 'relative', pointerEvents: 'none' }}>
                  <svg style={{ position: 'absolute', top: 12, right: -60, width: 60, height: 2, overflow: 'visible' }}>
                    <line x1="0" y1="0" x2="60" y2="0" stroke="#10b981" strokeWidth="2" strokeDasharray="3 2" />
                    <circle cx="60" cy="0" r="3" fill="#10b981" />
                  </svg>
                  <div className="glass-panel" style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #10b981', background: 'rgba(15,23,42,0.92)' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10b981' }}>Piece 1: Conical Rock Shoe</div>
                    <div style={{ fontSize: '0.66rem', color: '#cbd5e1' }}>44mm to 22mm Frustum Footing</div>
                  </div>
                </div>
              </Html>
            )}

            {/* Piece 2 Spike Anchor Callout */}
            {(showLabels || hoveredComp === 'conical_spike_anchor' || selectedComponent === 'conical_spike_anchor') && (
              <Html position={[3.2, -16.25 + expY_spike, 0]} distanceFactor={13}>
                <div style={{ position: 'relative', pointerEvents: 'none' }}>
                  <svg style={{ position: 'absolute', top: 12, left: -60, width: 60, height: 2, overflow: 'visible' }}>
                    <line x1="0" y1="0" x2="60" y2="0" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 2" />
                    <circle cx="0" cy="0" r="3" fill="#ef4444" />
                  </svg>
                  <div className="glass-panel" style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #ef4444', background: 'rgba(15,23,42,0.92)' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ef4444' }}>Piece 2: Sharp Spike Anchor</div>
                    <div style={{ fontSize: '0.66rem', color: '#cbd5e1' }}>Carbide Tip (4 Lock Grooves)</div>
                  </div>
                </div>
              </Html>
            )}
          </group>
        )}


        {/* -------------------------------------------------------------
            1. MAIN SHAFT (44 mm Ø - Elongated 18.0 Units Length), PINS & OPEN ALIGNMENT MARK
           ------------------------------------------------------------- */}
        <group position={[0, expY_shaft, 0]}>
          {/* Main Shaft Outer Shell (44mm Outer Ø -> r=2.2, height=18.0, Bottom Rim at Y=-12.0) */}
          <mesh position={[0, -3.0, 0]} {...bindHoverEvents('main_shaft')} castShadow receiveShadow>
            <cylinderGeometry args={[2.2, 2.2, 18.0, 32, 1, true]} />
            <meshStandardMaterial {...getMaterialProps('main_shaft', '#475569', 0.85, 0.35)} side={THREE.DoubleSide} />
          </mesh>

          {/* Main Shaft Inner Bore Wall Shell (Central Bore r=0.65, height=18.0) creating solid 1.55-unit thick physical tube wall */}
          <mesh position={[0, -3.0, 0]} {...bindHoverEvents('main_shaft')}>
            <cylinderGeometry args={[0.65, 0.65, 18.0, 32, 1, true]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>

          {/* Shaft Top Annular Rim Lip Face connecting outer & inner wall shells at Y=+6.0 */}
          <mesh position={[0, 6.0, 0]} rotation={[Math.PI / 2, 0, 0]} {...bindHoverEvents('main_shaft')}>
            <ringGeometry args={[0.65, 2.2, 32]} />
            <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.35} side={THREE.DoubleSide} />
          </mesh>

          {/* Shaft Bottom Annular Rim Lip Face at Y=-12.0 */}
          <mesh position={[0, -12.0, 0]} rotation={[Math.PI / 2, 0, 0]} {...bindHoverEvents('main_shaft')}>
            <ringGeometry args={[0.65, 2.2, 32]} />
            <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.35} side={THREE.DoubleSide} />
          </mesh>

          {/* 2. Shaft Lock Pin A (Left at 0°, 3mm protrusion -> r=0.2, length=0.6, Height=+5.6 near top rim) */}
          <group position={[2.35 + expX_pins, 5.6, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh {...bindHoverEvents('shaft_lock_pin_left')}>
              <cylinderGeometry args={[0.2, 0.2, 0.6, 16]} />
              <meshStandardMaterial {...getMaterialProps('shaft_lock_pin_left', '#cbd5e1', 0.95, 0.15)} />
            </mesh>
            {selectedComponent === 'shaft_lock_pin_left' && (
              <Html position={[0, 0.8, 0]} center distanceFactor={12}>
                <div className="component-tag">2. shaft_lock_pin_left</div>
              </Html>
            )}
          </group>

          {/* 3. Shaft Lock Pin B (Right at 180°, 3mm protrusion -> r=0.2, length=0.6, Height=+5.6 near top rim) */}
          <group position={[-2.35 - expX_pins, 5.6, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh {...bindHoverEvents('shaft_lock_pin_right')}>
              <cylinderGeometry args={[0.2, 0.2, 0.6, 16]} />
              <meshStandardMaterial {...getMaterialProps('shaft_lock_pin_right', '#cbd5e1', 0.95, 0.15)} />
            </mesh>
            {selectedComponent === 'shaft_lock_pin_right' && (
              <Html position={[0, 0.8, 0]} center distanceFactor={12}>
                <div className="component-tag">3. shaft_lock_pin_right</div>
              </Html>
            )}
          </group>

          {/* 15. Fixed Shaft OPEN 0° Alignment Mark (3D Engraved White Triangle at 0°) */}
          <group position={[2.22, 4.4, 0]} rotation={[0, Math.PI / 2, 0]}>
            <mesh {...bindHoverEvents('open_alignment_mark')}>
              <coneGeometry args={[0.22, 0.45, 3]} />
              <meshStandardMaterial {...getMaterialProps('open_alignment_mark', '#ffffff', 0.1, 0.2)} emissive="#ffffff" emissiveIntensity={0.8} />
            </mesh>
          </group>
        </group>

        {/* -------------------------------------------------------------
            PIECE 1: FLAT-TIP CONICAL ROCK SHOE FOOTING (r_top=2.20, r_bottom=1.10, height=2.50)
            Mounted directly at bottom rim of main shaft (Y=-12.00) extending down to Y=-14.50
           ------------------------------------------------------------- */}
        <group
          position={[0, -13.25 + expY_shoe, 0]}
          {...bindHoverEvents('bottom_conical_shoe')}
        >
          {/* Truncated Cone Frustum Outer Shell */}
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[2.2, 1.1, 2.5, 32, 1, true]} />
            <meshStandardMaterial
              {...getMaterialProps('bottom_conical_shoe', '#475569', 0.9, 0.2)}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Inner Bore Wall Shell (Central Bore r=0.65 for Threaded Rod) */}
          <mesh>
            <cylinderGeometry args={[0.65, 0.65, 2.5, 32, 1, true]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>

          {/* Top Annular Rim Face at Y=+1.25 inside local group (Y=-12.00 global) */}
          <mesh position={[0, 1.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.65, 2.2, 32]} />
            <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.35} side={THREE.DoubleSide} />
          </mesh>

          {/* Bottom Flat Annular Tip Face at Y=-1.25 inside local group (Y=-14.50 global) */}
          <mesh position={[0, -1.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.65, 1.1, 32]} />
            <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>

          {selectedComponent === 'bottom_conical_shoe' && (
            <Html position={[0, -1.8, 0]} center distanceFactor={12}>
              <div className="component-tag">Piece 1: bottom_conical_shoe (Flat-Tip Frustum)</div>
            </Html>
          )}
        </group>

        {/* -------------------------------------------------------------
            PIECE 2: CONICAL SPIKE ANCHOR (conical_spike_anchor)
            Mounted below Piece 1 (Y=-14.50 to Y=-18.00). Features sharp tip + flat top disc face.
            KINEMATICS:
            - When LOCKED (+45° or -45°): Tab A & Tab B seat in lock pockets -> Spike is LOCKED to threaded rod and drives DOWNWARD into bedrock as cap turns!
            - When DETACHED (0°): Tabs float in neutral clearance zone -> Spike stays stationary while rod spins free!
           ------------------------------------------------------------- */}
        {(() => {
          const isSpikeLocked = Math.abs(spikeLockAngle || 0) > 0.1;
          const isFreeFalling = Boolean(spikeDetached && !isSpikeLocked);
          const activeThreadOffset = Math.max(-3.40, Math.min(0.0, -capRotationAngle * 0.54));
          // When FREE-FALLING (detached at 0° neutral), spike drops down to subterranean bedrock floor (Y=-18.00)!
          // Mag Field level drives relative axial displacement towards or away from Piece 1 rock shoe!
          const spikeYPos = isFreeFalling
            ? -18.00 + expY_spike + magSpikeOffset
            : -16.25 + expY_spike + activeThreadOffset + magSpikeOffset;
          // When locked, whole spike rotates together with top cap & threaded rod! When disengaged (0°), spike body stays stationary (0°).
          const spikeBodyRotation = isSpikeLocked ? capRotationAngle + (spikeLockAngle || 0) : 0;




          return (
            <group
              position={[0, spikeYPos, 0]}
              rotation={[0, spikeBodyRotation, 0]}
              {...bindHoverEvents('conical_spike_anchor')}
            >


              {/* Sharp Conical Spike Solid Body (r_top=1.10, sharp tip r_bottom=0.08, height=3.50) */}
              <mesh castShadow receiveShadow>
                <cylinderGeometry args={[1.1, 0.08, 3.5, 32]} />
                <meshStandardMaterial
                  {...getMaterialProps('conical_spike_anchor', '#1e293b', 0.95, 0.1)}
                />
              </mesh>

              {/* Top Flat Mounting Disc Face at Y=+1.75 (Y=-14.50 global) */}
              <mesh position={[0, 1.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <circleGeometry args={[1.1, 32]} />
                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} side={THREE.DoubleSide} />
              </mesh>

              {/* Central Circular Clearance Zone (r=0.50) surrounding central drive rod axis */}
              <mesh position={[0, 1.76, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.0, 0.5, 32]} />
                <meshStandardMaterial color="#1e293b" metalness={0.95} roughness={0.1} side={THREE.DoubleSide} />
              </mesh>

              {/* -------------------------------------------------------------
                  4 SEPARATE CLOSED-ENDED MACHINED GROOVE CHANNELS & END LOCK POCKETS
                 ------------------------------------------------------------- */}
              {/* Lock Groove 1 (Upper-Left Diagonal at 135°) */}
              <group position={[-0.53, 1.77, 0.53]} rotation={[0, -Math.PI / 4, 0]} {...bindHoverEvents('lock_groove_1')}>
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.18, 0.06, 0.45]} />
                  <meshStandardMaterial {...getMaterialProps('lock_groove_1', '#ef4444', 0.9, 0.2)} />
                </mesh>
                <mesh position={[0, -0.04, -0.22]}>
                  <cylinderGeometry args={[0.12, 0.12, 0.1, 16]} />
                  <meshStandardMaterial color="#b91c1c" metalness={0.9} roughness={0.1} />
                </mesh>
              </group>

              {/* Lock Groove 2 (Upper-Right Diagonal at 45°) */}
              <group position={[0.53, 1.77, 0.53]} rotation={[0, Math.PI / 4, 0]} {...bindHoverEvents('lock_groove_2')}>
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.18, 0.06, 0.45]} />
                  <meshStandardMaterial {...getMaterialProps('lock_groove_2', '#10b981', 0.9, 0.2)} />
                </mesh>
                <mesh position={[0, -0.04, -0.22]}>
                  <cylinderGeometry args={[0.12, 0.12, 0.1, 16]} />
                  <meshStandardMaterial color="#047857" metalness={0.9} roughness={0.1} />
                </mesh>
              </group>

              {/* Lock Groove 3 (Lower-Left Diagonal at 225°) */}
              <group position={[-0.53, 1.77, -0.53]} rotation={[0, Math.PI / 4, 0]} {...bindHoverEvents('lock_groove_3')}>
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.18, 0.06, 0.45]} />
                  <meshStandardMaterial {...getMaterialProps('lock_groove_3', '#10b981', 0.9, 0.2)} />
                </mesh>
                <mesh position={[0, -0.04, 0.22]}>
                  <cylinderGeometry args={[0.12, 0.12, 0.1, 16]} />
                  <meshStandardMaterial color="#047857" metalness={0.9} roughness={0.1} />
                </mesh>
              </group>

              {/* Lock Groove 4 (Lower-Right Diagonal at 315°) */}
              <group position={[0.53, 1.77, -0.53]} rotation={[0, -Math.PI / 4, 0]} {...bindHoverEvents('lock_groove_4')}>
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.18, 0.06, 0.45]} />
                  <meshStandardMaterial {...getMaterialProps('lock_groove_4', '#ef4444', 0.9, 0.2)} />
                </mesh>
                <mesh position={[0, -0.04, 0.22]}>
                  <cylinderGeometry args={[0.12, 0.12, 0.1, 16]} />
                  <meshStandardMaterial color="#b91c1c" metalness={0.9} roughness={0.1} />
                </mesh>
              </group>

              {/* -------------------------------------------------------------
                  ROTARY DRIVE PLATE WITH DUAL-OPPOSED TABS (rotary_drive_plate_with_opposed_tabs)
                  Rigidly connected to central threaded rod! Drives downward with thread translation!
                 ------------------------------------------------------------- */}
              {(() => {
                const tabRadialDist = isSpikeLocked ? 0.75 : 0.32;
                const tabYOffset = isSpikeLocked ? 1.73 : 1.82;
                const drivePlateYLocal = isFreeFalling ? 1.75 + activeThreadOffset : 0;
                const drivePlateRelativeRot = isSpikeLocked ? 0 : capRotationAngle;


                return (
                  <group
                    position={[0, drivePlateYLocal, 0]}
                    rotation={[0, drivePlateRelativeRot, 0]}
                    {...bindHoverEvents('rotary_drive_plate_with_opposed_tabs')}
                  >


                    {/* Central Drive Shaft Connection Extension (Connects 100% to threaded rod tip) */}
                    <mesh position={[0, 2.1, 0]}>
                      <cylinderGeometry args={[0.25, 0.25, 0.7, 16]} />
                      <meshStandardMaterial {...getMaterialProps('rotary_drive_plate_with_opposed_tabs', '#0284c7', 0.9, 0.1)} />
                    </mesh>
                    <mesh position={[0, 1.85, 0]}>
                      <boxGeometry args={[0.15, 0.12, 1.5]} />
                      <meshStandardMaterial {...getMaterialProps('rotary_drive_plate_with_opposed_tabs', '#38bdf8', 0.95, 0.1)} />
                    </mesh>
                    <mesh position={[0, tabYOffset, tabRadialDist]} castShadow>
                      <cylinderGeometry args={[0.1, 0.1, 0.18, 16]} />
                      <meshStandardMaterial color={isSpikeLocked ? '#f59e0b' : '#38bdf8'} metalness={0.95} roughness={0.1} />
                    </mesh>
                    <mesh position={[0, tabYOffset, -tabRadialDist]} castShadow>
                      <cylinderGeometry args={[0.1, 0.1, 0.18, 16]} />
                      <meshStandardMaterial color={isSpikeLocked ? '#f59e0b' : '#38bdf8'} metalness={0.95} roughness={0.1} />
                    </mesh>
                  </group>
                );
              })()}

              {/* 3D Live Lock Status Indicator Badge */}
              <Html position={[0, 2.6, 0]} center distanceFactor={11}>
                <div
                  style={{
                    background: isFreeFalling
                      ? '#38bdf8'
                      : (spikeLockAngle || 0) < -0.1
                      ? '#ef4444'
                      : (spikeLockAngle || 0) > 0.1
                      ? '#10b981'
                      : '#eab308',
                    color: '#0f172a',
                    padding: '4px 14px',
                    borderRadius: '16px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    whiteSpace: 'nowrap',
                    border: '1.5px solid #ffffff',
                  }}
                >
                  {isFreeFalling
                    ? '⚡ DETACHED (Free-Fall Bedrock Floor)'
                    : (spikeLockAngle || 0) < -0.1
                    ? '🔒 LEFT LOCK ENGAGED (Grooves 1 + 4)'
                    : (spikeLockAngle || 0) > 0.1
                    ? '🔒 RIGHT LOCK ENGAGED (Grooves 2 + 3)'
                    : '⭕ CENTERED / NEUTRAL (Ready to Detach)'}
                </div>
              </Html>

              {selectedComponent === 'conical_spike_anchor' && (
                <Html position={[0, -2.2, 0]} center distanceFactor={12}>
                  <div className="component-tag">Piece 2: conical_spike_anchor (Sharp Tip)</div>
                </Html>
              )}
              {selectedComponent === 'rotary_drive_plate_with_opposed_tabs' && (
                <Html position={[0, 3.2, 0]} center distanceFactor={12}>
                  <div className="component-tag">⚙️ rotary_drive_plate_with_opposed_tabs</div>
                </Html>
              )}
            </group>
          );
        })()}





        {/* -------------------------------------------------------------
            4. TOP CAP (58 mm OD Single Physical Shell - Multi-Chamber Height 12.45, Bottom Rim at Entry Slot Mouth Y=-4.2)
           ------------------------------------------------------------- */}
        <group ref={capGroupRef}>

          {/* Hardened Circular Steel Strike Disk (42 mm Ø -> r=2.1, height=0.3 at top Y=+8.4) */}
          <mesh position={[0, 8.4, 0]} {...bindHoverEvents('strike_cap_steel')} castShadow>
            <cylinderGeometry args={[2.1, 2.1, 0.3, 32]} />
            <meshStandardMaterial {...getMaterialProps('strike_cap_steel', '#94a3b8', 0.95, 0.15)} />
          </mesh>
          {selectedComponent === 'strike_cap_steel' && (
            <Html position={[0, 8.9, 0]} center distanceFactor={12}>
              <div className="component-tag">1. strike_cap_steel (Impact Head)</div>
            </Html>
          )}

          {/* Main Cap Outer Shell (58mm OD -> r=2.9, Height=12.45, Bottom Rim Lip at Y=-4.2) */}
          <mesh position={[0, 2.025, 0]} {...bindHoverEvents('top_cap')} castShadow receiveShadow>
            <cylinderGeometry args={[2.9, 2.9, 12.45, 32, 1, true]} />
            <meshStandardMaterial {...getMaterialProps('top_cap', '#1e293b', 0.6, 0.4)} side={THREE.DoubleSide} />
          </mesh>

          {/* Main Cap Inner Wall Shell (46mm ID -> r=2.3, Height=12.4, Bottom Rim Lip at Y=-4.2) creating solid 6mm wall thickness */}
          <mesh position={[0, 2.025, 0]} {...bindHoverEvents('top_cap')}>
            <cylinderGeometry args={[2.3, 2.3, 12.4, 32, 1, true]} />
            <meshStandardMaterial {...getMaterialProps('top_cap', '#1e293b', 0.6, 0.4)} side={THREE.DoubleSide} />
          </mesh>

          {/* Solid Bottom Wall Rim Lip starting EXACTLY at Entry Slot Mouth (local Y=-4.2) */}
          <mesh position={[0, -4.2, 0]} rotation={[Math.PI / 2, 0, 0]} {...bindHoverEvents('top_cap')}>
            <ringGeometry args={[2.3, 2.9, 32]} />
            <meshStandardMaterial {...getMaterialProps('top_cap', '#1e293b', 0.6, 0.4)} side={THREE.DoubleSide} />
          </mesh>

          {/* Top Cap Ceiling Lid Plate (Fitted Flush to Inner Wall r=2.30 at local Y=+8.25) */}
          <mesh position={[0, 8.25, 0]} rotation={[Math.PI / 2, 0, 0]} {...bindHoverEvents('top_cap')}>
            <ringGeometry args={[0.5, 2.3, 32]} />
            <meshStandardMaterial {...getMaterialProps('top_cap', '#1e293b', 0.6, 0.4)} side={THREE.DoubleSide} />
          </mesh>

          {/* -------------------------------------------------------------
              INTERNAL CD-LIKE BULKHEAD DIVIDER PLATE 1 (Directly Above Level 2 at local Y=+0.80)
              Partition between Chamber 1 (Locking) and Chamber 2 (Screw Drive)
             ------------------------------------------------------------- */}
          <group position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh castShadow receiveShadow>
              <ringGeometry args={[0.5, 2.3, 32]} />
              <meshStandardMaterial
                color="#334155"
                metalness={0.9}
                roughness={0.2}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          {/* -------------------------------------------------------------
              INTERNAL CD-LIKE BULKHEAD DIVIDER PLATE 2 (Upper Partition at local Y=+4.50)
              Partition between Chamber 2 (Screw Drive) and Chamber 3 (Telemetry Electronics)
             ------------------------------------------------------------- */}
          <group position={[0, 4.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh castShadow receiveShadow>
              <ringGeometry args={[0.5, 2.3, 32]} />
              <meshStandardMaterial
                color="#38bdf8"
                metalness={0.95}
                roughness={0.15}
                emissive="#0284c7"
                emissiveIntensity={cutawayMode ? 0.6 : 0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          {/* -------------------------------------------------------------
              HEAVY INDUSTRIAL SPINNING HELICAL THREADED SCREW-DRIVE ROD (r=0.45, Length=21.0)
              Blue Hex Drive Coupling Head (#0284c7, r=0.55) stops DEAD at CD Bulkhead Plate 1 (local Y=+0.80)!
              Un-tightened (offset=0.0): Blue head at local Y=+4.20 (below CD Plate 2 at Y=+4.50), lowest thread at local Y=+1.00 (above CD Plate 1).
              Fully tightened (offset=-3.40): Blue head STOPS DEAD at CD Plate 1 (local Y=+0.80)!
              Bottom tip extends 2.40 units past the main shaft bottom rim (Y=-14.40) into subterranean bedrock!
             ------------------------------------------------------------- */}
          {(() => {
            const threadDownwardOffset = Math.max(-3.40, Math.min(0.0, -capRotationAngle * 0.54));
            const threadAngles = Array.from({ length: 58 }, (_, i) => i);
            return (
              <group
                position={[0, -9.0 + threadDownwardOffset, 0]}
                rotation={[0, capRotationAngle, 0]}
                {...bindHoverEvents('threaded_screw_rod')}
              >
                {/* Central Threaded Shaft Solid Steel Core (Extended 27.0 Units Length down to Piece 2) */}
                <mesh castShadow receiveShadow>
                  <cylinderGeometry args={[0.45, 0.45, 27.0, 32]} />
                  <meshStandardMaterial
                    {...getMaterialProps('threaded_screw_rod', '#cbd5e1', 0.95, 0.15)}
                    emissive={selectedComponent === 'threaded_screw_rod' ? '#eab308' : '#000000'}
                    emissiveIntensity={selectedComponent === 'threaded_screw_rod' ? 0.6 : 0}
                  />
                </mesh>

                {/* 58 Stacked Helical Acme Screw Thread Rings across full extended length */}
                {threadAngles.map((i) => (
                  <mesh
                    key={i}
                    position={[0, -12.8 + i * 0.45, 0]}
                    rotation={[Math.PI / 2 + 0.1, 0, i * (Math.PI / 4)]}
                  >
                    <torusGeometry args={[0.48, 0.05, 12, 24]} />
                    <meshStandardMaterial
                      color={cutawayMode ? '#eab308' : '#64748b'}
                      metalness={0.9}
                      roughness={0.2}
                      emissive={cutawayMode ? '#eab308' : '#000000'}
                      emissiveIntensity={cutawayMode ? 0.7 : 0}
                    />
                  </mesh>
                ))}

                {/* Top Blue Hex Socket Drive Coupling Head (Stops DEAD at CD Bulkhead Plate 1 Y=+0.80) */}
                <mesh position={[0, 13.5, 0]}>
                  <cylinderGeometry args={[0.55, 0.55, 0.35, 6]} />
                  <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.2} />
                </mesh>

                {selectedComponent === 'threaded_screw_rod' && (
                  <Html position={[0, 14.0, 0]} center distanceFactor={12}>
                    <div className="component-tag">⚙️ threaded_screw_rod (Extended 27.0u Drive Shaft)</div>
                  </Html>
                )}
              </group>
            );
          })()}












          {/* 16 Heavy Vertical Tactile Grip Ribs around full 12.45 height */}
          {ribAngles.map((angle, idx) => (
            <mesh
              key={idx}
              position={[Math.sin(angle) * 2.92, 2.025, Math.cos(angle) * 2.92]}
              rotation={[0, angle, 0]}
              {...bindHoverEvents('top_cap')}
            >
              <boxGeometry args={[0.16, 12.45, 0.1]} />
              <meshStandardMaterial
                color={selectedComponent === 'top_cap' ? '#38bdf8' : '#334155'}
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
          ))}

          {/* Flush 3D Engraved Cyan Alignment Triangle Arrow directly on Cap Outer Wall (Bottom Rim at Y=-4.2) */}
          <group position={[2.92, -3.8, 0]} rotation={[0, Math.PI / 2, Math.PI]}>
            <mesh {...bindHoverEvents('top_cap')}>
              <coneGeometry args={[0.22, 0.45, 3]} />
              <meshStandardMaterial color="#00f2fe" emissive="#00f2fe" emissiveIntensity={0.9} metalness={0.9} roughness={0.1} />
            </mesh>
          </group>



          {/* -------------------------------------------------------------
              SMOOTHLY CONNECTED CARVED INTERNAL 2-LEVEL GROOVE PATTERN (r=2.36)
              Vertical Entry -> Level 1 Bayonet Track (Cyan) -> Transfer Push Slot (Yellow) -> Level 2 Retaining Groove (Green)
             ------------------------------------------------------------- */}

          {/* 1. Level 1 Vertical Entry Slot (Left at 0° - Spans Rim Y=-4.2 to Level 1 Y=-1.2) */}
          <group position={[2.36, -2.7, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.2, 3.0, 0.45]} />
              <meshStandardMaterial
                color={cutawayMode ? '#00f2fe' : '#0f172a'}
                metalness={0.9}
                roughness={0.2}
                emissive={cutawayMode ? '#00f2fe' : '#000000'}
                emissiveIntensity={cutawayMode ? 0.85 : 0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          {/* Level 1 Vertical Entry Slot (Right at 180°) */}
          <group position={[-2.36, -2.7, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.2, 3.0, 0.45]} />
              <meshStandardMaterial
                color={cutawayMode ? '#00f2fe' : '#0f172a'}
                metalness={0.9}
                roughness={0.2}
                emissive={cutawayMode ? '#00f2fe' : '#000000'}
                emissiveIntensity={cutawayMode ? 0.85 : 0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          {/* 2. Level 1 90° Circumferential Bayonet Track (Left 0° to 90° CW at local Y=-1.2, Cyan Blue) */}
          <group position={[0, -1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh castShadow receiveShadow>
              <torusGeometry args={[2.36, 0.18, 16, 32, Math.PI / 2]} />
              <meshStandardMaterial
                color={cutawayMode ? '#00f2fe' : '#0f172a'}
                metalness={0.9}
                roughness={0.2}
                emissive={cutawayMode ? '#00f2fe' : '#000000'}
                emissiveIntensity={cutawayMode ? 0.85 : 0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          {/* Level 1 90° Circumferential Bayonet Track (Right 180° to 270° CW) */}
          <group position={[0, -1.2, 0]} rotation={[Math.PI / 2, 0, Math.PI]}>
            <mesh castShadow receiveShadow>
              <torusGeometry args={[2.36, 0.18, 16, 32, Math.PI / 2]} />
              <meshStandardMaterial
                color={cutawayMode ? '#00f2fe' : '#0f172a'}
                metalness={0.9}
                roughness={0.2}
                emissive={cutawayMode ? '#00f2fe' : '#000000'}
                emissiveIntensity={cutawayMode ? 0.85 : 0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          {/* 3. Transfer Push Groove (Vertical Push Slot at 90° CW index seamlessly bridging Y=-1.2 to Y=-0.6, Glowing Yellow) */}
          <group position={[0, -0.9, 2.36]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.45, 0.72, 0.2]} />
              <meshStandardMaterial
                color={cutawayMode ? '#eab308' : '#0f172a'}
                metalness={0.9}
                roughness={0.2}
                emissive={cutawayMode ? '#eab308' : '#000000'}
                emissiveIntensity={cutawayMode ? 0.9 : 0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          {/* Transfer Push Groove (Right at 270° CW index) */}
          <group position={[0, -0.9, -2.36]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.45, 0.72, 0.2]} />
              <meshStandardMaterial
                color={cutawayMode ? '#eab308' : '#0f172a'}
                metalness={0.9}
                roughness={0.2}
                emissive={cutawayMode ? '#eab308' : '#000000'}
                emissiveIntensity={cutawayMode ? 0.9 : 0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          {/* 4. Level 2 Annular Retaining Groove (Continuous 360° Circular Channel at local Y=-0.6, Emerald Green) */}
          <group position={[0, -0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh castShadow receiveShadow>
              <torusGeometry args={[2.36, 0.18, 16, 48]} />
              <meshStandardMaterial
                color={cutawayMode ? '#10b981' : '#0f172a'}
                metalness={0.9}
                roughness={0.2}
                emissive={cutawayMode ? '#10b981' : '#000000'}
                emissiveIntensity={cutawayMode ? 0.85 : 0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>



        </group>




        {/* -------------------------------------------------------------
            HAMMER LOAD PATH VISUALIZER OVERLAY
            (Direct strike cap to outer shaft force transmission)
           ------------------------------------------------------------- */}
        {showLoadPath && (
          <group>
            {[-2.22, 2.22].map((x, i) => (
              <group key={i} position={[x, 0, 0]}>
                <mesh position={[0, -0.4, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 4.5, 12]} />
                  <meshBasicMaterial color="#ef4444" transparent opacity={0.85} />
                </mesh>
                <group ref={loadPulseRef}>
                  <mesh>
                    <sphereGeometry args={[0.22, 16, 16]} />
                    <meshBasicMaterial color="#fef08a" />
                  </mesh>
                </group>
              </group>
            ))}
            <Html position={[0, 5.2, 0]} center distanceFactor={14}>
              <div className="load-path-badge">
                ⚡ Direct Hammer Force Path (Electronics 100% Isolated)
              </div>
            </Html>
          </group>
        )}




      </group>
    </PivotControls>
  );
};
