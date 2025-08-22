import { StyleSheet, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Physics Ball</ThemedText>
      <Link href="/game?mode=levels" asChild>
        <Pressable style={styles.button}>
          <ThemedText style={styles.buttonText}>Play Levels</ThemedText>
        </Pressable>
      </Link>
      <Link href="/game?mode=versus" asChild>
        <Pressable style={styles.button}>
          <ThemedText style={styles.buttonText}>Play vs PC</ThemedText>
        </Pressable>
      </Link>
      <Link href="/game?mode=tournament" asChild>
        <Pressable style={styles.button}>
          <ThemedText style={styles.buttonText}>Tournament</ThemedText>
        </Pressable>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  title: {
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
  },
});
