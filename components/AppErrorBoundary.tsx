import { Component, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isSessionExpiredError } from '../errorReporting';
import { readableError } from '../errorMessage';

type Props = {
  children: ReactNode;
  // Called when the person taps the button: `sessionExpired` tells the app to
  // clear the saved login before starting over.
  onReset: (sessionExpired: boolean) => void;
};

// Last line of defense: a query that fails while a screen is rendering (for
// example a session that ran out) would otherwise crash to a red error
// screen. This shows a plain message with a way back instead. Uses fixed
// colors and system text on purpose — it can't rely on anything that might be
// what failed.
export default class AppErrorBoundary extends Component<Props, { error: unknown | null }> {
  state = { error: null as unknown | null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.log('Screen error caught by boundary:', readableError(error));
  }

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;

    const expired = isSessionExpiredError(error);
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{expired ? 'Please log in again' : 'Something went wrong'}</Text>
        <Text style={styles.body}>
          {expired ? 'Your session has expired.' : readableError(error)}
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            this.setState({ error: null });
            this.props.onReset(expired);
          }}
        >
          <Text style={styles.buttonText}>{expired ? 'Log in' : 'Try again'}</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F6F4F1',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#000000', textAlign: 'center' },
  body: { marginTop: 8, fontSize: 15, color: 'rgba(0,0,0,0.6)', textAlign: 'center' },
  button: {
    marginTop: 24,
    height: 46,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  buttonText: { fontSize: 15, fontWeight: '700', color: '#F6F4F1' },
});
