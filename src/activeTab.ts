import { createContext, useContext } from 'react'
import type { AppTab } from './components/TabBar'

/**
 * The tab currently shown.
 *
 * Every tab stays MOUNTED — App only toggles a `hidden` class (App.tsx:68-96) —
 * so a component on a background tab still runs its effects and still receives
 * `window` events. Any global key handler must therefore gate on this, or it
 * fires while the user is somewhere else entirely: the space bar on the Drone
 * tab was starting and stopping Practice playback.
 */
export const ActiveTabContext = createContext<AppTab | null>(null)

/** True when `tab` is the tab the user is actually looking at. */
export function useIsActiveTab(tab: AppTab): boolean {
  return useContext(ActiveTabContext) === tab
}
