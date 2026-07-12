// TouchControls — virtual joystick overlay for mobile
// Renders visual feedback for touch input (does NOT intercept touches)

import React, { useRef, useEffect, useState } from 'react';
import type { InputManager, InputState } from '@sandbox/engine';

interface TouchControlsProps {
  input: InputManager;
  enabled?: boolean;
}

interface JoystickState {
  visible: boolean;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
  moveX: number;
  moveY: number;
}

export default function TouchControls({ input, enabled = true }: TouchControlsProps) {
  const rafRef = useRef<number>(0);
  const [joystick, setJoystick] = useState<JoystickState>({
    visible: false,
    originX: 0,
    originY: 0,
    knobX: 0,
    knobY: 0,
    moveX: 0,
    moveY: 0,
  });
  const [cameraActive, setCameraActive] = useState(false);
  const [jumpPressed, setJumpPressed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    if (!enabled || !isMobile) return;

    const poll = () => {
      const state: InputState = input.getState() as any;

      if (state.touches.length > 0) {
        const hasMove = state.touchMoveX !== 0 || state.touchMoveY !== 0;
        setJoystick(prev => {
          const firstTouch = state.touches[0];
          return {
            visible: hasMove,
            originX: prev.visible ? prev.originX : (firstTouch?.startX ?? 0),
            originY: prev.visible ? prev.originY : (firstTouch?.startY ?? 0),
            knobX: state.touchMoveX,
            knobY: state.touchMoveY,
            moveX: state.touchMoveX,
            moveY: state.touchMoveY,
          };
        });

        setCameraActive(state.touchDeltaX !== 0 || state.touchDeltaY !== 0);
        setJumpPressed(state.actions.has('jump'));
      } else {
        setJoystick(prev => ({ ...prev, visible: false, moveX: 0, moveY: 0 }));
        setCameraActive(false);
        setJumpPressed(false);
      }

      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [input, enabled, isMobile]);

  if (!enabled || !isMobile) return null;

  const baseSize = 140;
  const halfBase = baseSize / 2;
  const knobSize = 60;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 5,
    }}>
      {/* Virtual joystick — left side */}
      {joystick.visible && (
        <div style={{
          position: 'absolute',
          left: `${joystick.originX - halfBase}px`,
          top: `${joystick.originY - halfBase}px`,
          width: `${baseSize}px`,
          height: `${baseSize}px`,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '2px solid rgba(255,255,255,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: `${knobSize}px`,
            height: `${knobSize}px`,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.4)',
            transform: `translate(${joystick.knobX * 40}px, ${joystick.knobY * 40}px)`,
            transition: 'transform 0.05s linear',
          }}/>
        </div>
      )}

      {/* Idle joystick hint */}
      {!joystick.visible && (
        <div style={{
          position: 'absolute',
          left: '20px',
          bottom: '80px',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          border: '1.5px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            border: '1.5px solid rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>◉</span>
          </div>
        </div>
      )}

      {/* Camera drag indicator */}
      {cameraActive && (
        <div style={{
          position: 'absolute',
          right: '20px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'rgba(137,180,250,0.1)',
          border: '1.5px solid rgba(137,180,250,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ color: 'rgba(137,180,250,0.4)', fontSize: '16px' }}>👁</span>
        </div>
      )}

      {/* Jump button */}
      <div style={{
        position: 'absolute',
        right: '30px',
        bottom: '100px',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: jumpPressed
          ? 'rgba(52,152,219,0.3)'
          : 'rgba(255,255,255,0.06)',
        border: jumpPressed
          ? '2px solid rgba(52,152,219,0.5)'
          : '1.5px solid rgba(255,255,255,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.1s, border-color 0.1s',
      }}>
        <span style={{
          color: jumpPressed ? 'rgba(52,152,219,0.8)' : 'rgba(255,255,255,0.3)',
          fontSize: '24px',
          fontWeight: 'bold',
        }}>
          ↑
        </span>
      </div>
    </div>
  );
}
