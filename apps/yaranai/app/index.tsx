import { Redirect } from 'expo-router';
import { useSession } from '@yaranai/core';

export default function Index() {
  const session = useSession();
  return <Redirect href={session ? '/(app)' : '/(auth)/sign-in'} />;
}
