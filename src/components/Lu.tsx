// Lu: a soft pink drop with a face, little arms and a crescent-moon clip.
// She feels alive without costing much: every movement runs on the UI thread (Reanimated), with no React re-renders.
// - idle: she breathes (a slow squash and bob), blinks now and then and glances around.
// - thinking: she tilts side to side and looks up, as if searching for the answer.
// - `cheer` changes (a new answer arrived): a small happy hop, a wider smile and, with arms, a wave.
// `still` turns all of it off (the tiny avatars on every message); Reduce Motion keeps only the blink.
import React, { useEffect } from "react";
import Animated, {
  cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withSpring, withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from "react-native-svg";

const AEllipse = Animated.createAnimatedComponent(Ellipse);
const ACircle = Animated.createAnimatedComponent(Circle);
const APath = Animated.createAnimatedComponent(Path);
const AG = Animated.createAnimatedComponent(G);

const sine = Easing.inOut(Easing.sin);

export function Lu({ size = 84, arms = false, thinking = false, still = false, cheer = 0 }: {
  size?: number; arms?: boolean; thinking?: boolean; still?: boolean; cheer?: number;
}) {
  const reduced = useReducedMotion();
  const calm = still || reduced;
  const breath = useSharedValue(0); // 0…1, slow loop
  const tilt = useSharedValue(0); // -1…1 while thinking
  const lid = useSharedValue(1); // 1 open, 0 closed
  const look = useSharedValue(0); // eyes' sideways glance, -1…1
  const up = useSharedValue(0); // eyes looking up while thinking
  const hop = useSharedValue(0); // jump height, 0…1
  const smile = useSharedValue(0); // 0 normal, 1 big smile
  const wave = useSharedValue(0); // right arm angle

  // breathing + glancing around
  useEffect(() => {
    if (calm) { breath.value = 0; look.value = 0; return; }
    breath.value = withRepeat(withTiming(1, { duration: 2600, easing: sine }), -1, true);
    look.value = withRepeat(withSequence(
      withDelay(2400, withTiming(-1, { duration: 380, easing: sine })), withDelay(900, withTiming(0, { duration: 380, easing: sine })),
      withDelay(3200, withTiming(1, { duration: 380, easing: sine })), withDelay(800, withTiming(0, { duration: 380, easing: sine })),
    ), -1);
    return () => { cancelAnimation(breath); cancelAnimation(look); };
  }, [calm]);

  // blinking: a quick close and open every few seconds, sometimes twice
  useEffect(() => {
    if (still) return;
    const blink = withSequence(withTiming(0, { duration: 70 }), withTiming(1, { duration: 110 }));
    lid.value = withRepeat(withSequence(withDelay(3800, blink), withDelay(4600, withSequence(blink, withDelay(120, blink)))), -1);
    return () => cancelAnimation(lid);
  }, [still]);

  // thinking: tilt and look up
  useEffect(() => {
    if (!thinking || calm) { tilt.value = withTiming(0, { duration: 180 }); up.value = withTiming(0, { duration: 180 }); return; }
    up.value = withTiming(1, { duration: 260 });
    tilt.value = withRepeat(withSequence(withTiming(1, { duration: 520, easing: sine }), withTiming(-1, { duration: 520, easing: sine })), -1, true);
    return () => cancelAnimation(tilt);
  }, [thinking, calm]);

  // a new answer: hop, smile and wave
  useEffect(() => {
    if (!cheer) return;
    smile.value = withSequence(withTiming(1, { duration: 160 }), withDelay(1400, withTiming(0, { duration: 400 })));
    if (calm) return;
    hop.value = withSequence(withTiming(1, { duration: 170, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9, stiffness: 220 }));
    if (arms) wave.value = withSequence(withTiming(-28, { duration: 160 }), withTiming(10, { duration: 160 }), withTiming(-24, { duration: 160 }), withSpring(0, { damping: 12 }));
  }, [cheer]);

  const body = useAnimatedStyle(() => {
    const b = breath.value;
    return {
      transform: [
        { translateY: -b * size * 0.03 - hop.value * size * 0.16 },
        { rotate: `${tilt.value * 5}deg` },
        // squash on the ground, stretch in the air
        { scaleX: 1 + b * 0.018 - hop.value * 0.04 },
        { scaleY: 1 - b * 0.012 + hop.value * 0.06 },
      ],
    };
  });

  const eyeL = useAnimatedProps(() => ({ cx: 39 + look.value * 3, cy: 61 - up.value * 3, ry: 0.8 + lid.value * 4.8 }));
  const eyeR = useAnimatedProps(() => ({ cx: 61 + look.value * 3, cy: 61 - up.value * 3, ry: 0.8 + lid.value * 4.8 }));
  const glintL = useAnimatedProps(() => ({ cx: 40.5 + look.value * 3, cy: 59 - up.value * 3, opacity: lid.value > 0.6 ? 1 : 0 }));
  const glintR = useAnimatedProps(() => ({ cx: 62.5 + look.value * 3, cy: 59 - up.value * 3, opacity: lid.value > 0.6 ? 1 : 0 }));
  const mouth = useAnimatedProps(() => {
    const d = 6 + smile.value * 5, w = 6 + smile.value * 2;
    return { d: `M${50 - w} 72 q${w} ${d} ${w * 2} 0` };
  });
  const cheeks = useAnimatedProps(() => ({ opacity: 0.45 + smile.value * 0.3 }));
  const cheeks2 = useAnimatedProps(() => ({ opacity: 0.45 + smile.value * 0.3 }));
  const arm = useAnimatedProps(() => ({ rotation: wave.value }));

  return (
    <Animated.View style={[{ width: size, height: size }, body]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="luBody" cx="38%" cy="32%" r="78%">
            <Stop offset="0" stopColor="#FFE1EA" />
            <Stop offset="0.55" stopColor="#F6A9C0" />
            <Stop offset="1" stopColor="#E17899" />
          </RadialGradient>
        </Defs>
        {arms && (
          <>
            <Path d="M20 66 q-12 -4 -14 -16" stroke="#E17899" strokeWidth={7} fill="none" strokeLinecap="round" />
            <AG animatedProps={arm} originX={80} originY={66}>
              <Path d="M80 66 q10 4 12 12" stroke="#E17899" strokeWidth={7} fill="none" strokeLinecap="round" />
            </AG>
          </>
        )}
        <Path d="M50 5 C60 22 85 41 85 63 A35 35 0 0 1 15 63 C15 41 40 22 50 5Z" fill="url(#luBody)" />
        <Ellipse cx={36} cy={38} rx={7} ry={4.5} fill="#fff" opacity={0.6} transform="rotate(-30 36 38)" />
        <Path d="M62 26 a8 8 0 1 0 8 11 a6 6 0 1 1 -8 -11z" fill="#B9476E" />
        <AEllipse animatedProps={eyeL} rx={4.2} fill="#3D2631" />
        <AEllipse animatedProps={eyeR} rx={4.2} fill="#3D2631" />
        <ACircle animatedProps={glintL} r={1.5} fill="#fff" />
        <ACircle animatedProps={glintR} r={1.5} fill="#fff" />
        <AEllipse animatedProps={cheeks} cx={29} cy={71} rx={5.5} ry={3.5} fill="#F0628C" />
        <AEllipse animatedProps={cheeks2} cx={71} cy={71} rx={5.5} ry={3.5} fill="#F0628C" />
        <APath animatedProps={mouth} stroke="#3D2631" strokeWidth={3} fill="none" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}
