/*
  Demo DB (localStorage):
  - users
  - session
  - matches (10 minutos)
  - bets
  - deposits (Mercado Pago)
*/

export type User = {
  id: string;
  name: string;
  email: string;
  // demo only
  password: string;
  balance: number;
  createdAt: number;
};

export type Session = {
  userId: string;
};

export type Match = {
  id: string;
  teams: string[];
  startsAt: number;
  endsAt: number;
  status: "open" | "settled";
  winner?: string;
};

export type Bet = {
  id: string;
  userId: string;
  matchId: string;
  pick: string;
  amount: number;
  createdAt: number;
  status: "pending" | "won" | "lost";
  payout?: number;
};

export type Deposit = {
  id: string;
  userId: string;
  amount: number;
  createdAt: number;
  status: "pending" | "completed";
  mpPaymentId?: string;
};

const K = {
  users: "prode.users",
  session: "prode.session",
  matches: "prode.matches",
  bets: "prode.bets",
  deposits: "prode.deposits",
} as const;

function now() {
  return Date.now();
}

function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getArray<T>(key: string) {
  if (typeof window === "undefined") return [] as T[];
  return safeParseJSON<T[]>(localStorage.getItem(key), []);
}

function setArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function uuid() {
  // suficiente para demo
  return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

// Session
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  return safeParseJSON<Session | null>(localStorage.getItem(K.session), null);
}

export function setSession(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(K.session, JSON.stringify({ userId } satisfies Session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(K.session);
}

// Users
export function getUsers(): User[] {
  return getArray<User>(K.users);
}

export function getUserById(id: string): User | undefined {
  return getUsers().find((u) => u.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  return getUsers().find((u) => u.email === email);
}

export function createUser(input: {
  name: string;
  email: string;
  password: string;
}): User {
  const users = getUsers();
  const user: User = {
    id: uuid(),
    name: input.name,
    email: input.email,
    password: input.password,
    balance: 0,
    createdAt: now(),
  };
  users.push(user);
  setArray(K.users, users);
  return user;
}

export function addBalance(userId: string, amount: number) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) throw new Error("Usuario no encontrado");
  users[idx] = { ...users[idx], balance: users[idx].balance + amount };
  setArray(K.users, users);
}

export function subtractBalance(userId: string, amount: number) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) throw new Error("Usuario no encontrado");
  if (users[idx].balance < amount) throw new Error("Saldo insuficiente");
  users[idx] = { ...users[idx], balance: users[idx].balance - amount };
  setArray(K.users, users);
}

// Matches
export function getMatches(): Match[] {
  return getArray<Match>(K.matches);
}

export function getMatchById(id: string): Match | undefined {
  return getMatches().find((m) => m.id === id);
}

export function createMatchIfMissing(input: {
  teams: string[];
  durationMinutes: number;
}): Match {
  const matches = getMatches();
  // usamos el último match; si está open, lo retornamos.
  const last = matches.at(-1);
  if (last && last.status === "open") return last;

  const startsAt = now();
  const endsAt = startsAt + input.durationMinutes * 60_000;
  const match: Match = {
    id: uuid(),
    teams: input.teams,
    startsAt,
    endsAt,
    status: "open",
  };
  matches.push(match);
  setArray(K.matches, matches);
  return match;
}

// Bets
export function getBets(): Bet[] {
  return getArray<Bet>(K.bets);
}

export function getBetsForUser(userId: string): Bet[] {
  return getBets()
    .filter((b) => b.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function placeBet(input: {
  userId: string;
  matchId: string;
  pick: string;
  amount: number;
}) {
  if (input.amount <= 0) throw new Error("Monto inválido");
  const match = getMatchById(input.matchId);
  if (!match) throw new Error("Partido no encontrado");
  if (match.status !== "open" || match.endsAt <= now()) {
    throw new Error("El partido ya finalizó");
  }
  if (!match.teams.includes(input.pick)) {
    throw new Error("Equipo inválido");
  }

  // una apuesta por match por usuario (simple)
  const bets = getBets();
  const existing = bets.find(
    (b) => b.userId === input.userId && b.matchId === input.matchId
  );
  if (existing) throw new Error("Ya apostaste este partido");

  subtractBalance(input.userId, input.amount);
  const bet: Bet = {
    id: uuid(),
    userId: input.userId,
    matchId: input.matchId,
    pick: input.pick,
    amount: input.amount,
    createdAt: now(),
    status: "pending",
  };
  bets.push(bet);
  setArray(K.bets, bets);
}

export function settleExpiredMatches() {
  const matches = getMatches();
  const bets = getBets();
  let changed = false;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.status === "open" && m.endsAt <= now()) {
      const winner = m.teams[Math.floor(Math.random() * m.teams.length)];
      matches[i] = { ...m, status: "settled", winner };
      changed = true;

      for (let j = 0; j < bets.length; j++) {
        const b = bets[j];
        if (b.matchId !== m.id || b.status !== "pending") continue;
        if (b.pick === winner) {
          const payout = b.amount * 2;
          bets[j] = { ...b, status: "won", payout };
          addBalance(b.userId, payout);
        } else {
          bets[j] = { ...b, status: "lost" };
        }
      }
    }
  }

  if (changed) {
    setArray(K.matches, matches);
    setArray(K.bets, bets);
  }
}

// Deposits
export function getDeposits(): Deposit[] {
  return getArray<Deposit>(K.deposits);
}

export function createDeposit(input: {
  userId: string;
  amount: number;
  mpPaymentId?: string;
}): Deposit {
  const deposits = getDeposits();
  const dep: Deposit = {
    id: uuid(),
    userId: input.userId,
    amount: input.amount,
    createdAt: now(),
    status: "pending",
    mpPaymentId: input.mpPaymentId,
  };
  deposits.push(dep);
  setArray(K.deposits, deposits);
  return dep;
}

export function getDeposit(id: string): Deposit | undefined {
  return getDeposits().find((d) => d.id === id);
}

export function completeDeposit(input: { depositId: string; userId: string }) {
  const deposits = getDeposits();
  const idx = deposits.findIndex((d) => d.id === input.depositId);
  if (idx < 0) throw new Error("Depósito no encontrado");
  const dep = deposits[idx];
  if (dep.userId !== input.userId) throw new Error("Depósito inválido");
  if (dep.status === "completed") return;
  deposits[idx] = { ...dep, status: "completed" };
  setArray(K.deposits, deposits);
  addBalance(dep.userId, dep.amount);
}

export function upsertDeposit(input: {
  depositId: string;
  userId: string;
  amount: number;
  mpPaymentId?: string;
}) {
  const deposits = getDeposits();
  const idx = deposits.findIndex((d) => d.id === input.depositId);
  if (idx >= 0) {
    const existing = deposits[idx];
    // No pisamos un depósito completado
    if (existing.status === "completed") return existing;
    deposits[idx] = {
      ...existing,
      userId: input.userId,
      amount: input.amount,
      mpPaymentId: input.mpPaymentId ?? existing.mpPaymentId,
    };
    setArray(K.deposits, deposits);
    return deposits[idx];
  }

  const dep: Deposit = {
    id: input.depositId,
    userId: input.userId,
    amount: input.amount,
    createdAt: now(),
    status: "pending",
    mpPaymentId: input.mpPaymentId,
  };
  deposits.push(dep);
  setArray(K.deposits, deposits);
  return dep;
}
