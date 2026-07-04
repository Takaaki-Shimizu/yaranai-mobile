import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../lib/session';
import { colors } from '../../lib/theme';

export default function AppLayout() {
  const session = useSession();
  if (!session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.kinari },
      }}
    />
  );
}
