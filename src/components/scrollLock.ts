import { createContext, useContext } from 'react';

/**
 * Lets a gesture inside a Screen stop the page scrolling while it runs (a chart scrub). On iOS
 * the scroll view's pan runs natively alongside JS touch handlers, so declining to hand over
 * the touch isn't enough; the scroll view has to be switched off. Outside a Screen it does nothing.
 */
export const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});

export const useScrollLock = () => useContext(ScrollLockContext);
