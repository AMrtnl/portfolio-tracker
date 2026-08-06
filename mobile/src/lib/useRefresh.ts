import { useCallback, useState } from 'react';
import { errorFeedback, successFeedback, tapFeedback } from './haptics';

/**
 * Pull-to-refresh with haptic bookends: a light tap when the gesture commits,
 * then success or error once the network settles. Keeps the spinner visible for
 * the whole refetch rather than flashing off on the first resolved query.
 */
export function useRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    tapFeedback();
    try {
      await refetch();
      successFeedback();
    } catch {
      errorFeedback();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return { refreshing, onRefresh };
}
