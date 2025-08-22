import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const ROOM_SIZE = 8;
const BALL_RADIUS = 0.3;
const CUP_RADIUS = 0.5;
const CUP_HEIGHT = 1;
const GRAVITY = 9.8;

const BALLS = {
  bouncy: { color: '#0a7ea4', bounce: 0.9 },
  heavy: { color: '#444', bounce: 0.2 },
};

const LEVELS = [
  {
    start: { x: -4, z: 4 },
    goal: { x: 4, z: -4 },
  },
  {
    start: { x: -4, z: 4 },
    goal: { x: -4, z: -4 },
  },
];

type BallType = 'bouncy' | 'heavy';
type Mode = 'levels' | 'versus' | 'tournament';

export default function GameScreen() {
  const { mode = 'levels' } = useLocalSearchParams<{ mode: Mode }>();
  const [level, setLevel] = useState(0);
  const [ballType, setBallType] = useState<BallType>('bouncy');
  const [unlocked, setUnlocked] = useState<string[]>(['bouncy']);
  const [message, setMessage] = useState('');
  const [playerTurn, setPlayerTurn] = useState(true);
  const [playerScore, setPlayerScore] = useState(0);
  const [pcScore, setPcScore] = useState(0);
  const [round, setRound] = useState(1);

  const rendererRef = useRef<Renderer>();
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const ballRef = useRef<THREE.Mesh>();
  const cupRef = useRef<THREE.Mesh>();
  const indicatorRef = useRef<THREE.Mesh>();
  const velocity = useRef(new THREE.Vector3());
  const launched = useRef(false);
  const lastTime = useRef(0);
  const requestRef = useRef<number>();

  const updateBallColor = React.useCallback(() => {
    if (ballRef.current) {
      const color = playerTurn ? BALLS[ballType].color : 'tomato';
      (ballRef.current.material as THREE.MeshStandardMaterial).color.set(color);
    }
  }, [playerTurn, ballType]);

  useEffect(() => {
    updateBallColor();
  }, [updateBallColor]);

  const onContextCreate = async (gl: any) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#fff');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_SIZE * 2, ROOM_SIZE * 2),
      new THREE.MeshStandardMaterial({ color: '#eee' })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: '#ddd' });
    const wallZ = new THREE.BoxGeometry(ROOM_SIZE * 2, ROOM_SIZE, 0.1);
    const wallX = new THREE.BoxGeometry(0.1, ROOM_SIZE, ROOM_SIZE * 2);
    const w1 = new THREE.Mesh(wallZ, wallMat);
    w1.position.set(0, ROOM_SIZE / 2, -ROOM_SIZE);
    const w2 = w1.clone();
    w2.position.z = ROOM_SIZE;
    const w3 = new THREE.Mesh(wallX, wallMat);
    w3.position.set(-ROOM_SIZE, ROOM_SIZE / 2, 0);
    const w4 = w3.clone();
    w4.position.x = ROOM_SIZE;
    scene.add(w1, w2, w3, w4);

    const levelDef = LEVELS[level];

    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(CUP_RADIUS, CUP_RADIUS, CUP_HEIGHT, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: '#0a7ea4', side: THREE.DoubleSide })
    );
    cup.position.set(levelDef.goal.x, CUP_HEIGHT / 2, levelDef.goal.z);
    scene.add(cup);
    cupRef.current = cup;

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
      new THREE.MeshStandardMaterial({ color: BALLS[ballType].color })
    );
    ball.position.set(levelDef.start.x, BALL_RADIUS, levelDef.start.z);
    scene.add(ball);
    ballRef.current = ball;

    const indicator = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1, 8),
      new THREE.MeshBasicMaterial({ color: 'tomato' })
    );
    indicator.visible = false;
    scene.add(indicator);
    indicatorRef.current = indicator;

    const animate = (time: number) => {
      requestRef.current = requestAnimationFrame(animate);
      const delta = lastTime.current ? (time - lastTime.current) / 1000 : 0;
      lastTime.current = time;

      if (launched.current && ballRef.current) {
        velocity.current.y -= GRAVITY * delta;
        ballRef.current.position.addScaledVector(velocity.current, delta);

        const bounce = BALLS[ballType].bounce;
        const pos = ballRef.current.position;
        if (pos.y < BALL_RADIUS) {
          pos.y = BALL_RADIUS;
          velocity.current.y = -velocity.current.y * bounce;
          if (Math.abs(velocity.current.y) < 0.1) velocity.current.y = 0;
        }
        if (pos.x < -ROOM_SIZE + BALL_RADIUS) {
          pos.x = -ROOM_SIZE + BALL_RADIUS;
          velocity.current.x = -velocity.current.x * bounce;
        }
        if (pos.x > ROOM_SIZE - BALL_RADIUS) {
          pos.x = ROOM_SIZE - BALL_RADIUS;
          velocity.current.x = -velocity.current.x * bounce;
        }
        if (pos.z < -ROOM_SIZE + BALL_RADIUS) {
          pos.z = -ROOM_SIZE + BALL_RADIUS;
          velocity.current.z = -velocity.current.z * bounce;
        }
        if (pos.z > ROOM_SIZE - BALL_RADIUS) {
          pos.z = ROOM_SIZE - BALL_RADIUS;
          velocity.current.z = -velocity.current.z * bounce;
        }

        const goal = LEVELS[level].goal;
        if (
          pos.y < CUP_HEIGHT &&
          Math.hypot(pos.x - goal.x, pos.z - goal.z) < CUP_RADIUS
        ) {
          launched.current = false;
          handleScore();
          pos.set(goal.x, CUP_HEIGHT / 2, goal.z);
          velocity.current.set(0, 0, 0);
        }

        if (
          !launched.current &&
          mode !== 'levels' &&
          Math.abs(velocity.current.x) < 0.01 &&
          Math.abs(velocity.current.y) < 0.01 &&
          Math.abs(velocity.current.z) < 0.01
        ) {
          if (playerTurn) {
            setPlayerTurn(false);
            runPcTurn();
          } else {
            finishRound();
          }
        }
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate(0);
  };

  const updateIndicator = (dx: number, dy: number) => {
    const indicator = indicatorRef.current;
    const ball = ballRef.current;
    if (!indicator || !ball) return;
    const shot = new THREE.Vector3(-dx / 50, 0, -dy / 50);
    const length = shot.length();
    const dir = shot.clone().normalize();
    const thickness = Math.max(0.02, 0.1 - Math.min(1, length / 5) * 0.08);
    indicator.position.copy(ball.position.clone().add(dir.clone().multiplyScalar(length / 2)));
    indicator.scale.set(thickness / 0.05, length, thickness / 0.05);
    indicator.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !launched.current && playerTurn,
      onMoveShouldSetPanResponder: () => !launched.current && playerTurn,
      onPanResponderGrant: () => {
        if (!launched.current && playerTurn) {
          indicatorRef.current && (indicatorRef.current.visible = true);
        }
      },
      onPanResponderMove: (_, gesture) => {
        if (!launched.current && playerTurn) {
          updateIndicator(gesture.dx, gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (!launched.current && playerTurn) {
          const scale = 0.6;
          velocity.current.set(
            (-gesture.dx / 50) * scale,
            Math.hypot(gesture.dx, gesture.dy) / 50 * scale * 0.6,
            (-gesture.dy / 50) * scale
          );
          launched.current = true;
          indicatorRef.current && (indicatorRef.current.visible = false);
          setMessage('');
        }
      },
    })
  ).current;

  const resetBall = () => {
    const start = LEVELS[level].start;
    if (ballRef.current) {
      ballRef.current.position.set(start.x, BALL_RADIUS, start.z);
    }
    velocity.current.set(0, 0, 0);
    launched.current = false;
    indicatorRef.current && (indicatorRef.current.visible = false);
    updateBallColor();
  };

  const runPcTurn = () => {
    const start = LEVELS[level].start;
    const goal = LEVELS[level].goal;
    const t = 1.5;
    const vx = (goal.x - start.x) / t;
    const vz = (goal.z - start.z) / t;
    const vy = (CUP_HEIGHT - BALL_RADIUS) / t - (GRAVITY * t) / 2;
    setTimeout(() => {
      if (ballRef.current) {
        ballRef.current.position.set(start.x, BALL_RADIUS, start.z);
        velocity.current.set(vx, vy, vz);
        launched.current = true;
        updateBallColor();
      }
    }, 500);
  };

  const finishRound = () => {
    setPlayerTurn(true);
    if (mode === 'tournament') {
      if (round < 3) {
        setRound((r) => r + 1);
        resetBall();
      } else {
        const msg =
          playerScore > pcScore
            ? 'You won the tournament!'
            : playerScore < pcScore
            ? 'PC wins the tournament'
            : 'Tournament tied';
        setMessage(msg);
      }
    } else {
      resetBall();
    }
  };

  const handleScore = () => {
    if (mode === 'levels') {
      if (level === 0 && !unlocked.includes('heavy')) {
        setUnlocked([...unlocked, 'heavy']);
      }
      if (level + 1 < LEVELS.length) {
        const next = level + 1;
        setLevel(next);
        const start = LEVELS[next].start;
        if (ballRef.current) {
          ballRef.current.position.set(start.x, BALL_RADIUS, start.z);
        }
        velocity.current.set(0, 0, 0);
      } else {
        setMessage('All levels complete');
      }
    } else {
      if (playerTurn) {
        setPlayerScore((s) => s + 1);
        setPlayerTurn(false);
        runPcTurn();
      } else {
        setPcScore((s) => s + 1);
        finishRound();
      }
    }
  };

  const selectBall = (type: BallType) => {
    if (unlocked.includes(type)) {
      setBallType(type);
    }
  };

  return (
    <ThemedView style={styles.container} {...pan.panHandlers}>
      <GLView style={styles.board} onContextCreate={onContextCreate} />
      <View style={styles.ui} pointerEvents="box-none">
        <View style={styles.ballRow}>
          <Pressable
            onPress={() => selectBall('bouncy')}
            style={[styles.ballChoice, { backgroundColor: BALLS.bouncy.color, opacity: ballType === 'bouncy' ? 1 : 0.5 }]}
          >
            <ThemedText style={styles.choiceText}>Bouncy</ThemedText>
          </Pressable>
          {unlocked.includes('heavy') && (
            <Pressable
              onPress={() => selectBall('heavy')}
              style={[styles.ballChoice, { backgroundColor: BALLS.heavy.color, opacity: ballType === 'heavy' ? 1 : 0.5 }]}
            >
              <ThemedText style={styles.choiceText}>Heavy</ThemedText>
            </Pressable>
          )}
        </View>
        <ThemedText style={styles.message}>{message}</ThemedText>
        {mode !== 'levels' && (
          <ThemedText>{`Player ${playerScore} : PC ${pcScore}`}</ThemedText>
        )}
        {mode !== 'levels' && (
          <ThemedText>{playerTurn ? 'Your turn' : 'PC turn'}</ThemedText>
        )}
        <Pressable style={styles.reset} onPress={resetBall}>
          <ThemedText style={styles.resetText}>Reset</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  board: {
    flex: 1,
  },
  ui: {
    position: 'absolute',
    top: 40,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  ballRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ballChoice: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  choiceText: {
    color: '#fff',
  },
  message: {
    fontSize: 16,
  },
  reset: {
    marginTop: 12,
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  resetText: {
    color: '#fff',
  },
});

