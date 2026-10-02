import { QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from './src/stores/AppProvider';
import { queryClient } from './src/stores/queryClient';
import { RootNavigator } from './src/screens/RootNavigator';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <RootNavigator />
      </AppProvider>
    </QueryClientProvider>
  );
}
