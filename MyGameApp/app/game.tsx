import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BALL_RADIUS = 20;
const GRAVITY = 0.6;

const BALLS = {
  bouncy: { color: '#0a7ea4', bounce: 0.9 },
  heavy: { color: '#444', bounce: 0.2 },
};

const LEVELS = [
  {
    start: { x: 60, y: SCREEN_HEIGHT - 100 },
    goal: { x: SCREEN_WIDTH - 60, y: 60, size: 40 },
    obstacles: [
      { x: SCREEN_WIDTH / 2 - 50, y: SCREEN_HEIGHT / 2, width: 100, height: 20 },
    ],
  },
  {
    start: { x: 60, y: SCREEN_HEIGHT - 100 },
    goal: { x: SCREEN_WIDTH - 60, y: 60, size: 40 },
    obstacles: [],
  },
];

type BallState = { x: number; y: number; vx: number; vy: number; launched: boolean };

type Mode = 'levels' | 'versus' | 'tournament';

export default function GameScreen() {
  const { mode = 'levels' } = useLocalSearchParams<{ mode: Mode }>();
  const [level, setLevel] = useState(0);
  const [ballType, setBallType] = useState<'bouncy' | 'heavy'>('bouncy');
  const [unlocked, setUnlocked] = useState<string[]>(['bouncy']);
  const [message, setMessage] = useState('');
  const [playerTurn, setPlayerTurn] = useState(true);
  const [playerScore, setPlayerScore] = useState(0);
  const [pcScore, setPcScore] = useState(0);
  const [round, setRound] = useState(1);

  const levelDef = LEVELS[level];
  const [ball, setBall] = useState<BallState>({
    x: levelDef.start.x,
    y: levelDef.start.y,
    vx: 0,
    vy: 0,
    launched: false,
  });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !ball.launched && playerTurn,
      onMoveShouldSetPanResponder: () => !ball.launched && playerTurn,
      onPanResponderRelease: (_, gesture) => {
        if (!ball.launched && playerTurn) {
          setBall((b) => ({
            ...b,
            vx: gesture.vx * 30,
            vy: gesture.vy * 30,
            launched: true,
          }));
          setMessage('');
        }
      },
    })
  ).current;

  const firstLaunch = useRef(true);
  const suppressTurn = useRef(false);

  useEffect(() => {
    let frame: number;
    const step = () => {
      setBall((b) => {
        if (!b.launched) return b;
        let { x, y, vx, vy } = b;
        vy += GRAVITY;
        x += vx;
        y += vy;
        const bounce = BALLS[ballType].bounce;
        if (x < BALL_RADIUS) {
          x = BALL_RADIUS;
          vx = -vx * bounce;
        }
        if (x > SCREEN_WIDTH - BALL_RADIUS) {
          x = SCREEN_WIDTH - BALL_RADIUS;
          vx = -vx * bounce;
        }
        if (y < BALL_RADIUS) {
          y = BALL_RADIUS;
          vy = -vy * bounce;
        }
        if (y > SCREEN_HEIGHT - BALL_RADIUS) {
          y = SCREEN_HEIGHT - BALL_RADIUS;
          vy = -vy * bounce;
          if (Math.abs(vy) < 1) {
            // stop bouncing
            vx = 0;
            vy = 0;
            return { x, y, vx, vy, launched: false };
          }
        }
        levelDef.obstacles.forEach((o) => {
          if (
            x + BALL_RADIUS > o.x &&
            x - BALL_RADIUS < o.x + o.width &&
            y + BALL_RADIUS > o.y &&
            y - BALL_RADIUS < o.y + o.height
          ) {
            const overlapX = Math.min(
              x + BALL_RADIUS - o.x,
              o.x + o.width - (x - BALL_RADIUS)
            );
            const overlapY = Math.min(
              y + BALL_RADIUS - o.y,
              o.y + o.height - (y - BALL_RADIUS)
            );
            if (overlapX < overlapY) {
              vx = -vx * bounce;
              x += vx > 0 ? overlapX : -overlapX;
            } else {
              vy = -vy * bounce;
              y += vy > 0 ? overlapY : -overlapY;
            }
          }
        });
        return { x, y, vx, vy, launched: true };
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [ballType, levelDef]);

  // goal detection
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const goal = levelDef.goal;
    if (
      ball.x > goal.x &&
      ball.x < goal.x + goal.size &&
      ball.y > goal.y &&
      ball.y < goal.y + goal.size &&
      ball.launched
    ) {
      setMessage('Scored!');
      setBall({
        x: goal.x + goal.size / 2,
        y: goal.y + goal.size / 2,
        vx: 0,
        vy: 0,
        launched: false,
      });
      handleScore();
    }
  }, [ball, levelDef, playerTurn]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // turn management
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (firstLaunch.current) {
      firstLaunch.current = false;
      return;
    }
    if (suppressTurn.current) {
      suppressTurn.current = false;
      return;
    }
    if (!ball.launched && mode !== 'levels') {
      if (playerTurn) {
        setPlayerTurn(false);
        runPcTurn();
      } else {
        finishRound();
      }
    }
  }, [ball.launched, playerTurn, mode]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleScore = () => {
    if (mode === 'levels') {
      if (level === 0 && !unlocked.includes('heavy')) {
        setUnlocked([...unlocked, 'heavy']);
      }
      if (level + 1 < LEVELS.length) {
        const next = level + 1;
        setLevel(next);
        const start = LEVELS[next].start;
        setBall({ x: start.x, y: start.y, vx: 0, vy: 0, launched: false });
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

  const resetBall = () => {
    suppressTurn.current = true;
    const start = LEVELS[level].start;
    setBall({ x: start.x, y: start.y, vx: 0, vy: 0, launched: false });
  };

  const runPcTurn = () => {
    const start = LEVELS[level].start;
    const goal = levelDef.goal;
    const vx = (goal.x - start.x) / 30;
    const vy = (goal.y - start.y) / 30 - (GRAVITY * 30) / 2;
    setTimeout(() => {
      setBall({ x: start.x, y: start.y, vx, vy, launched: true });
    }, 500);
  };

  const selectBall = (type: 'bouncy' | 'heavy') => {
    if (unlocked.includes(type)) {
      setBallType(type);
    }
  };

  return (
    <ThemedView style={styles.container} {...pan.panHandlers}>
      {levelDef.obstacles.map((o, i) => (
        <View
          key={i}
          style={[styles.obstacle, { left: o.x, top: o.y, width: o.width, height: o.height }]}
        />
      ))}
      <View
        style={[
          styles.goal,
          { left: levelDef.goal.x, top: levelDef.goal.y, width: levelDef.goal.size, height: levelDef.goal.size },
        ]}
      />
      <View
        style={[
          styles.ball,
          {
            left: ball.x - BALL_RADIUS,
            top: ball.y - BALL_RADIUS,
            width: BALL_RADIUS * 2,
            height: BALL_RADIUS * 2,
            backgroundColor: playerTurn ? BALLS[ballType].color : 'tomato',
          },
        ]}
      />
      <View style={styles.ui} pointerEvents="box-none">
        <View style={styles.ballRow}>
          <Pressable
            onPress={() => selectBall('bouncy')}
            style={[styles.ballChoice, { backgroundColor: BALLS.bouncy.color, opacity: ballType === 'bouncy' ? 1 : 0.5 }]}>
            <ThemedText style={styles.choiceText}>Bouncy</ThemedText>
          </Pressable>
          {unlocked.includes('heavy') && (
            <Pressable
              onPress={() => selectBall('heavy')}
              style={[styles.ballChoice, { backgroundColor: BALLS.heavy.color, opacity: ballType === 'heavy' ? 1 : 0.5 }]}>
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
  ball: {
    position: 'absolute',
    borderRadius: BALL_RADIUS,
  },
  goal: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#0a7ea4',
    backgroundColor: 'rgba(10,126,164,0.2)',
  },
  obstacle: {
    position: 'absolute',
    backgroundColor: '#999',
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
