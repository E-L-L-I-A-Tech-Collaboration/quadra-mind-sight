import fs from 'fs';
import path from 'path';

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  curriculumWave: number;
  accountTier: 'free' | 'practitioner' | 'premium';
  stripeCustomerId?: string;
  joinedDate: string;
  updatedAt: string;
  avatarSymbol?: string;
  preferredBand?: string;
  primaryIntention?: string;
  dailyGoalMinutes?: number;
}

export interface UserCloudData {
  profile: UserProfileRecord;
  journal?: any[];
  progress?: any;
  sight?: any;
  lastSyncedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'cloud_db.json');

// Default seeded database with user_123 Observer as requested
const SEED_PROFILES: Record<string, UserCloudData> = {
  user_123: {
    profile: {
      uid: 'user_123',
      displayName: 'Observer',
      email: 'observer@quadra.sight',
      curriculumWave: 1,
      accountTier: 'premium',
      joinedDate: 'Sep 2026',
      updatedAt: new Date().toISOString(),
      avatarSymbol: 'orb',
      preferredBand: 'drift',
      primaryIntention: 'Cultivate metacognitive neutrality across cognitive shifts.',
      dailyGoalMinutes: 20,
    },
    journal: [],
    progress: {
      totalPracticeTimeSeconds: 1800,
      sessionsCompleted: 4,
      quadrantMinutes: { memory: 40, meaning: 35, present: 55, future: 30, meta: 60 },
      exerciseHistory: { quadra_sync: 2, memory_reconstruction: 1, four_point_awareness: 1 },
      averageFocusRating: 4.8,
      averageRelaxationRating: 4.7,
      currentWave: 1,
    },
    sight: { memory: 65, meaning: 45, present: 75, future: 60 },
    lastSyncedAt: new Date().toISOString(),
  },
};

class CloudDatabase {
  private db: Record<string, UserCloudData> = {};

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.db = JSON.parse(raw);
        // Ensure user_123 is present
        if (!this.db['user_123']) {
          this.db['user_123'] = SEED_PROFILES['user_123'];
          this.persist();
        }
      } else {
        this.db = { ...SEED_PROFILES };
        this.persist();
      }
    } catch (err) {
      console.warn('Using in-memory Cloud Store fallback:', err);
      this.db = { ...SEED_PROFILES };
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to write cloud_db.json to disk (in-memory mode):', err);
    }
  }

  public getProfile(uid: string): UserProfileRecord | null {
    return this.db[uid]?.profile || null;
  }

  public getProfileByEmail(email: string): UserProfileRecord | null {
    const normalized = email.trim().toLowerCase();
    for (const data of Object.values(this.db)) {
      if (data.profile.email.toLowerCase() === normalized) {
        return data.profile;
      }
    }
    return null;
  }

  public getProfileByStripeCustomerId(customerId: string): UserProfileRecord | null {
    for (const data of Object.values(this.db)) {
      if (data.profile.stripeCustomerId === customerId) {
        return data.profile;
      }
    }
    return null;
  }

  public upsertProfile(
    profileInput: Partial<UserProfileRecord> & { uid: string; email?: string }
  ): UserProfileRecord {
    const existing = this.db[profileInput.uid];
    const email = (profileInput.email || existing?.profile?.email || 'practitioner@quadra.sight').trim();
    const displayName = profileInput.displayName || existing?.profile?.displayName || 'Observer';
    const curriculumWave = profileInput.curriculumWave ?? existing?.profile?.curriculumWave ?? 1;
    const accountTier = profileInput.accountTier || existing?.profile?.accountTier || 'premium';

    const updatedProfile: UserProfileRecord = {
      uid: profileInput.uid,
      displayName,
      email,
      curriculumWave,
      accountTier,
      stripeCustomerId: profileInput.stripeCustomerId || existing?.profile?.stripeCustomerId,
      joinedDate: existing?.profile?.joinedDate || new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      updatedAt: new Date().toISOString(),
      avatarSymbol: profileInput.avatarSymbol || existing?.profile?.avatarSymbol || 'orb',
      preferredBand: profileInput.preferredBand || existing?.profile?.preferredBand || 'drift',
      primaryIntention: profileInput.primaryIntention || existing?.profile?.primaryIntention || 'Cultivate metacognitive neutrality across cognitive shifts.',
      dailyGoalMinutes: profileInput.dailyGoalMinutes ?? existing?.profile?.dailyGoalMinutes ?? 20,
    };

    if (existing) {
      existing.profile = updatedProfile;
      existing.lastSyncedAt = new Date().toISOString();
    } else {
      this.db[profileInput.uid] = {
        profile: updatedProfile,
        journal: [],
        progress: null,
        sight: null,
        lastSyncedAt: new Date().toISOString(),
      };
    }

    this.persist();
    return updatedProfile;
  }

  public getCloudSync(uid: string): UserCloudData | null {
    return this.db[uid] || null;
  }

  public saveCloudSync(
    uid: string,
    payload: { profile?: Partial<UserProfileRecord>; journal?: any[]; progress?: any; sight?: any }
  ): UserCloudData {
    let entry = this.db[uid];
    if (!entry) {
      this.upsertProfile({
        uid,
        displayName: payload.profile?.displayName || 'Observer',
        email: payload.profile?.email || 'practitioner@quadra.sight',
        curriculumWave: payload.profile?.curriculumWave || 1,
        accountTier: payload.profile?.accountTier || 'premium',
      });
      entry = this.db[uid];
    }

    if (payload.profile) {
      entry.profile = {
        ...entry.profile,
        ...payload.profile,
        updatedAt: new Date().toISOString(),
      };
    }

    if (Array.isArray(payload.journal)) {
      // Merge unique journal entries by id
      const existingEntries = entry.journal || [];
      const entryMap = new Map<string, any>();
      for (const j of existingEntries) entryMap.set(j.id, j);
      for (const j of payload.journal) entryMap.set(j.id, j);
      entry.journal = Array.from(entryMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    if (payload.progress) {
      entry.progress = payload.progress;
      if (payload.progress.currentWave) {
        entry.profile.curriculumWave = payload.progress.currentWave;
      }
    }

    if (payload.sight) {
      entry.sight = payload.sight;
    }

    entry.lastSyncedAt = new Date().toISOString();
    this.persist();
    return entry;
  }

  public getAllProfiles(): UserProfileRecord[] {
    return Object.values(this.db).map((d) => d.profile);
  }
}

export const cloudStore = new CloudDatabase();
