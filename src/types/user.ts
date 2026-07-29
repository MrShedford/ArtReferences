/** The signed-in user, as every /api/user endpoint returns them. */
export interface SessionUser {
  id: number
  email: string
  /** Whatever Google last told us. Refreshed on every sign-in. */
  name: string | null
  /** What the user chose to be called. null means "hasn't set one". */
  displayName: string | null
  pictureUrl: string | null
}

export interface List {
  id: number
  name: string
  /** The auto-created "Saved" list: renameable, not deletable. */
  isDefault: boolean
  itemCount: number
  createdAt: string
}
