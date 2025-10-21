import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import Navigation from './Components/Navigation';
import SignInModal from './Components/SignInModal';
import SignUpModal from './Components/SignUpModal';
import { TelemetryProvider } from './context/TelemetryContext';

const DEFAULT_ACCOUNTS = [
  {
    name: 'Angelo Zamora',
    email: 'angelo@shelvy.io',
    password: 'shelvy123',
  },
];

export default function App() {
  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);
  const [session, setSession] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  const handleSignIn = (email, password, remember) => {
    const normalizedEmail = email.trim().toLowerCase();
    const account = accounts.find((entry) => entry.email.trim().toLowerCase() === normalizedEmail);

    if (!account || account.password !== password) {
      Alert.alert('Invalid credentials', 'Please double-check your email and password.');
      return;
    }

    setSession({ name: account.name, email: account.email, remember });
    setShowSignIn(false);
  };

  const handleSignUp = (name, email, password, agreeTerms) => {
    if (!agreeTerms) {
      Alert.alert('Hold on', 'Please agree to the terms before creating an account.');
      return;
    }

    if (!name || !email || !password) {
      Alert.alert('Almost there', 'Kindly complete all fields to continue.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const exists = accounts.some((entry) => entry.email.trim().toLowerCase() === normalizedEmail);

    if (exists) {
      Alert.alert('Account exists', 'Looks like you already signed up. Try signing in instead.');
      setShowSignUp(false);
      setShowSignIn(true);
      return;
    }

    const nextAccount = { name, email, password };
    setAccounts((prev) => [...prev, nextAccount]);
    setSession({ name, email, remember: true });
    setShowSignUp(false);
  };

  const handleLogout = () => {
    setSession(null);
    setShowSignIn(false);
    setShowSignUp(false);
  };

  return (
    <TelemetryProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        {session ? (
          <Navigation user={session} onLogout={handleLogout} />
        ) : (
          <View style={styles.container}>
            <Text style={styles.title}>Shelvy</Text>
            <Text style={styles.subtitle}>Monitor your bread's freshness</Text>
            <Text style={styles.subtitle}>🍞</Text>

            <View style={styles.buttonContainer}>
              <Pressable
                style={({ pressed }) => [styles.button, styles.signInButton, pressed && styles.pressed]}
                onPress={() => setShowSignIn(true)}
              >
                <Text style={styles.signInText}>Sign In</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.button, styles.signUpButton, pressed && styles.pressed]}
                onPress={() => setShowSignUp(true)}
              >
                <Text style={styles.signUpText}>Sign Up</Text>
              </Pressable>
            </View>
          </View>
        )}

        <SignInModal
          open={showSignIn}
          onClose={() => setShowSignIn(false)}
          onSwitch={() => {
            setShowSignIn(false);
            setShowSignUp(true);
          }}
          onSubmit={handleSignIn}
        />

        <SignUpModal
          open={showSignUp}
          onClose={() => setShowSignUp(false)}
          onSwitch={() => {
            setShowSignUp(false);
            setShowSignIn(true);
          }}
          onSubmit={handleSignUp}
        />
      </SafeAreaView>
    </TelemetryProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f0e6',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f0e6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#b35c00',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b3e00',
    fontFamily: 'monospace',
    marginBottom: 10,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '70%',
    marginTop: 24,
  },
  button: {
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: '#c46a00',
  },
  signUpButton: {
    backgroundColor: '#e0d9d0',
    borderWidth: 1,
    borderColor: '#c46a00',
  },
  pressed: {
    opacity: 0.8,
  },
  signInText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  signUpText: {
    color: '#c46a00',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
});
