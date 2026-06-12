export interface BreakoutRoom {
  id: string;
  name: string;
  topic: string;
  duration: string;
  members: string[];
  createdAt: string;
}

const STORAGE_KEY = 'nova_breakout_rooms';

export function saveBreakoutRoom(room: BreakoutRoom) {
  const rooms = getBreakoutRooms();
  const existing = rooms.findIndex((r) => r.id === room.id);
  if (existing >= 0) {
    rooms[existing] = room;
  } else {
    rooms.unshift(room);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
}

export function getBreakoutRooms(): BreakoutRoom[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getBreakoutRoom(id: string): BreakoutRoom | null {
  return getBreakoutRooms().find((r) => r.id === id) ?? null;
}

export function parseDurationMinutes(duration: string): number {
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 30;
}