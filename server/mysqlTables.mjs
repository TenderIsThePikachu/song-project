import { getMysqlPool, queueMysqlWrite } from './sqliteState.mjs';

let schemaReadyPromise = null;

function parseJsonField(rawValue, fallback) {
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function toNumber(value, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

async function ensureMysqlSchema() {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  schemaReadyPromise = (async () => {
    const pool = getMysqlPool();

    const statements = [
      `
        CREATE TABLE IF NOT EXISTS auth_users (
          id VARCHAR(120) PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(120) NOT NULL,
          avatar_url LONGTEXT NULL,
          salt VARCHAR(255) NOT NULL,
          password_hash LONGTEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS auth_reset_requests (
          id VARCHAR(120) PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          requested_for_existing_user TINYINT(1) NOT NULL DEFAULT 0,
          created_at BIGINT NOT NULL,
          INDEX idx_auth_reset_email (email),
          INDEX idx_auth_reset_created_at (created_at)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS auth_sessions (
          id VARCHAR(120) PRIMARY KEY,
          token_hash VARCHAR(128) NOT NULL UNIQUE,
          email VARCHAR(255) NOT NULL,
          user_id VARCHAR(120) NOT NULL,
          created_at BIGINT NOT NULL,
          last_used_at BIGINT NOT NULL,
          INDEX idx_auth_session_email (email),
          INDEX idx_auth_session_last_used (last_used_at)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS user_settings (
          email VARCHAR(255) PRIMARY KEY,
          community_notifications TINYINT(1) NOT NULL DEFAULT 1,
          music_notifications TINYINT(1) NOT NULL DEFAULT 1,
          shorts_notifications TINYINT(1) NOT NULL DEFAULT 1,
          collab_notifications TINYINT(1) NOT NULL DEFAULT 1,
          profile_public TINYINT(1) NOT NULL DEFAULT 1,
          show_activity TINYINT(1) NOT NULL DEFAULT 1
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS message_friends (
          owner_email VARCHAR(255) NOT NULL,
          friend_email VARCHAR(255) NOT NULL,
          friend_name VARCHAR(120) NOT NULL,
          created_at BIGINT NOT NULL DEFAULT 0,
          PRIMARY KEY (owner_email, friend_email),
          INDEX idx_message_friends_owner (owner_email)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS message_threads (
          id VARCHAR(120) PRIMARY KEY,
          owner_email VARCHAR(255) NOT NULL,
          type VARCHAR(32) NOT NULL,
          title VARCHAR(160) NOT NULL,
          participant_name VARCHAR(120) NULL,
          participant_email VARCHAR(255) NULL,
          members_json LONGTEXT NOT NULL,
          last_message_at BIGINT NOT NULL,
          last_preview LONGTEXT NOT NULL,
          INDEX idx_message_threads_owner (owner_email),
          INDEX idx_message_threads_last_message (last_message_at)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS message_items (
          id VARCHAR(120) PRIMARY KEY,
          thread_id VARCHAR(120) NOT NULL,
          author_name VARCHAR(120) NOT NULL,
          author_email VARCHAR(255) NOT NULL,
          content LONGTEXT NOT NULL,
          created_at BIGINT NOT NULL,
          is_read TINYINT(1) NOT NULL DEFAULT 0,
          INDEX idx_message_items_thread (thread_id),
          INDEX idx_message_items_created (created_at)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS library_projects (
          id VARCHAR(120) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description LONGTEXT NOT NULL,
          genre VARCHAR(120) NOT NULL,
          bpm INT NOT NULL,
          steps INT NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          creator_name VARCHAR(120) NOT NULL,
          creator_email VARCHAR(255) NOT NULL,
          project_json LONGTEXT NOT NULL,
          export_format VARCHAR(32) NOT NULL,
          is_shared TINYINT(1) NOT NULL DEFAULT 0,
          share_visibility VARCHAR(32) NOT NULL,
          share_midi_enabled TINYINT(1) NOT NULL DEFAULT 0,
          cover_image_url LONGTEXT NULL,
          cover_image_storage_key VARCHAR(255) NULL,
          cover_image_file_name VARCHAR(255) NULL,
          INDEX idx_library_projects_creator (creator_email),
          INDEX idx_library_projects_shared (is_shared),
          INDEX idx_library_projects_updated (updated_at)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS library_shared_tracks (
          id VARCHAR(120) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          progression VARCHAR(255) NOT NULL,
          reference_text VARCHAR(255) NOT NULL,
          category VARCHAR(64) NOT NULL,
          tags_json LONGTEXT NOT NULL,
          palette LONGTEXT NOT NULL,
          created_at BIGINT NOT NULL,
          creator_name VARCHAR(120) NOT NULL,
          creator_email VARCHAR(255) NOT NULL,
          image_url LONGTEXT NULL,
          INDEX idx_library_shared_tracks_created (created_at),
          INDEX idx_library_shared_tracks_category (category)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS library_favorites (
          user_email VARCHAR(255) NOT NULL,
          track_id VARCHAR(120) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          PRIMARY KEY (user_email, track_id),
          INDEX idx_library_favorites_user (user_email)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS library_track_likes (
          user_email VARCHAR(255) NOT NULL,
          track_id VARCHAR(120) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          PRIMARY KEY (user_email, track_id),
          INDEX idx_library_track_likes_user (user_email)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS library_recent_tracks (
          user_email VARCHAR(255) NOT NULL,
          track_id VARCHAR(120) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          PRIMARY KEY (user_email, track_id),
          INDEX idx_library_recent_tracks_user (user_email)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS library_track_metrics (
          track_id VARCHAR(120) PRIMARY KEY,
          like_count INT NOT NULL DEFAULT 0,
          view_count INT NOT NULL DEFAULT 0,
          download_count INT NOT NULL DEFAULT 0
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS library_track_comments (
          id VARCHAR(120) PRIMARY KEY,
          track_id VARCHAR(120) NOT NULL,
          author_name VARCHAR(120) NOT NULL,
          author_email VARCHAR(255) NOT NULL,
          content LONGTEXT NOT NULL,
          created_at BIGINT NOT NULL,
          INDEX idx_library_track_comments_track (track_id),
          INDEX idx_library_track_comments_created (created_at)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS community_posts (
          id VARCHAR(120) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          content LONGTEXT NOT NULL,
          author_id VARCHAR(255) NOT NULL,
          author_name VARCHAR(120) NOT NULL,
          created_at BIGINT NOT NULL,
          like_count INT NOT NULL DEFAULT 0,
          category VARCHAR(120) NOT NULL,
          comment_count INT NOT NULL DEFAULT 0,
          view_count INT NOT NULL DEFAULT 0,
          is_hot TINYINT(1) NOT NULL DEFAULT 0,
          tags_json LONGTEXT NOT NULL,
          INDEX idx_community_posts_created (created_at),
          INDEX idx_community_posts_author (author_id),
          INDEX idx_community_posts_category (category)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS community_comments (
          id VARCHAR(120) PRIMARY KEY,
          post_id VARCHAR(120) NOT NULL,
          parent_id VARCHAR(120) NULL,
          content LONGTEXT NOT NULL,
          author_name VARCHAR(120) NOT NULL,
          author_email VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL,
          like_count INT NOT NULL DEFAULT 0,
          INDEX idx_community_comments_post (post_id),
          INDEX idx_community_comments_parent (parent_id),
          INDEX idx_community_comments_created (created_at)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS community_post_likes (
          user_email VARCHAR(255) NOT NULL,
          post_id VARCHAR(120) NOT NULL,
          created_at BIGINT NOT NULL DEFAULT 0,
          PRIMARY KEY (user_email, post_id),
          INDEX idx_community_post_likes_post (post_id)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS community_post_bookmarks (
          user_email VARCHAR(255) NOT NULL,
          post_id VARCHAR(120) NOT NULL,
          created_at BIGINT NOT NULL DEFAULT 0,
          PRIMARY KEY (user_email, post_id),
          INDEX idx_community_post_bookmarks_post (post_id)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS community_post_reports (
          user_email VARCHAR(255) NOT NULL,
          post_id VARCHAR(120) NOT NULL,
          created_at BIGINT NOT NULL DEFAULT 0,
          PRIMARY KEY (user_email, post_id),
          INDEX idx_community_post_reports_post (post_id)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS community_blocked_authors (
          author_email VARCHAR(255) PRIMARY KEY,
          blocked_at BIGINT NOT NULL DEFAULT 0
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS session_recruit_posts (
          id VARCHAR(120) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          genre VARCHAR(120) NOT NULL,
          host_name VARCHAR(120) NOT NULL,
          host_email VARCHAR(255) NOT NULL,
          summary LONGTEXT NOT NULL,
          location VARCHAR(255) NOT NULL,
          region VARCHAR(32) NOT NULL,
          meeting_type VARCHAR(32) NOT NULL,
          status VARCHAR(32) NOT NULL,
          wanted_roles_json LONGTEXT NOT NULL,
          tags_json LONGTEXT NOT NULL,
          current_members INT NOT NULL DEFAULT 1,
          max_members INT NOT NULL DEFAULT 4,
          schedule_label VARCHAR(255) NOT NULL,
          urgent TINYINT(1) NOT NULL DEFAULT 0,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          INDEX idx_session_recruit_posts_updated (updated_at),
          INDEX idx_session_recruit_posts_region (region),
          INDEX idx_session_recruit_posts_status (status),
          INDEX idx_session_recruit_posts_host (host_email)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS learn_completed_lessons (
          user_key VARCHAR(255) NOT NULL,
          lesson_id VARCHAR(120) NOT NULL,
          PRIMARY KEY (user_key, lesson_id)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS learn_favorite_lessons (
          user_key VARCHAR(255) NOT NULL,
          lesson_id VARCHAR(120) NOT NULL,
          PRIMARY KEY (user_key, lesson_id)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS learn_quiz_answers (
          user_key VARCHAR(255) NOT NULL,
          lesson_id VARCHAR(120) NOT NULL,
          selected_index INT NOT NULL,
          is_correct TINYINT(1) NOT NULL DEFAULT 0,
          answered_at BIGINT NOT NULL,
          PRIMARY KEY (user_key, lesson_id)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS market_items (
          id VARCHAR(120) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          brand VARCHAR(120) NOT NULL,
          category VARCHAR(64) NOT NULL,
          status VARCHAR(32) NOT NULL,
          trade_type VARCHAR(32) NOT NULL,
          item_condition VARCHAR(120) NOT NULL,
          location VARCHAR(255) NOT NULL,
          price INT NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          urgent TINYINT(1) NOT NULL DEFAULT 0,
          palette LONGTEXT NOT NULL,
          seller_name VARCHAR(120) NOT NULL,
          seller_email VARCHAR(255) NOT NULL,
          description LONGTEXT NOT NULL,
          favorite_count INT NOT NULL DEFAULT 0,
          view_count INT NOT NULL DEFAULT 0,
          image_url LONGTEXT NULL,
          image_storage_key VARCHAR(255) NULL,
          image_file_name VARCHAR(255) NULL,
          INDEX idx_market_items_created (created_at),
          INDEX idx_market_items_updated (updated_at),
          INDEX idx_market_items_category (category),
          INDEX idx_market_items_status (status),
          INDEX idx_market_items_seller (seller_email)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS market_favorites (
          user_email VARCHAR(255) NOT NULL,
          item_id VARCHAR(120) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          PRIMARY KEY (user_email, item_id),
          INDEX idx_market_favorites_item (item_id)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS shorts_items (
          id VARCHAR(120) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description LONGTEXT NOT NULL,
          creator_name VARCHAR(120) NOT NULL,
          creator_email VARCHAR(255) NOT NULL,
          genre VARCHAR(80) NOT NULL DEFAULT '기타',
          tags_json LONGTEXT NOT NULL,
          created_at BIGINT NOT NULL,
          duration_label VARCHAR(32) NOT NULL,
          like_count INT NOT NULL DEFAULT 0,
          view_count INT NOT NULL DEFAULT 0,
          visibility VARCHAR(32) NOT NULL,
          tone VARCHAR(32) NOT NULL,
          video_url LONGTEXT NULL,
          video_storage_key VARCHAR(255) NULL,
          video_file_name VARCHAR(255) NULL,
          video_size_bytes BIGINT NULL,
          INDEX idx_shorts_items_created (created_at),
          INDEX idx_shorts_items_creator (creator_email)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS shorts_likes (
          short_id VARCHAR(120) NOT NULL,
          user_email VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL DEFAULT 0,
          PRIMARY KEY (short_id, user_email),
          INDEX idx_shorts_likes_user (user_email)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS shorts_comments (
          id VARCHAR(120) PRIMARY KEY,
          short_id VARCHAR(120) NOT NULL,
          author_name VARCHAR(120) NOT NULL,
          author_email VARCHAR(255) NOT NULL,
          content LONGTEXT NOT NULL,
          created_at BIGINT NOT NULL,
          INDEX idx_shorts_comments_short (short_id),
          INDEX idx_shorts_comments_created (created_at)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS collab_projects (
          id VARCHAR(120) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          summary LONGTEXT NOT NULL,
          genre VARCHAR(120) NOT NULL,
          bpm INT NOT NULL,
          steps INT NOT NULL,
          status VARCHAR(32) NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          owner_email VARCHAR(255) NOT NULL,
          owner_name VARCHAR(120) NOT NULL,
          source_project_id VARCHAR(120) NULL,
          tags_json LONGTEXT NOT NULL,
          snapshot_json LONGTEXT NULL,
          snapshot_revision INT NOT NULL DEFAULT 0,
          snapshot_updated_by_email VARCHAR(255) NULL,
          snapshot_updated_by_session_id VARCHAR(120) NULL,
          INDEX idx_collab_projects_updated (updated_at),
          INDEX idx_collab_projects_owner (owner_email)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS collab_project_members (
          project_id VARCHAR(120) NOT NULL,
          email VARCHAR(255) NOT NULL,
          name VARCHAR(120) NOT NULL,
          role VARCHAR(32) NOT NULL,
          joined_at BIGINT NOT NULL,
          PRIMARY KEY (project_id, email),
          INDEX idx_collab_project_members_email (email)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS collab_project_messages (
          id VARCHAR(120) PRIMARY KEY,
          project_id VARCHAR(120) NOT NULL,
          author_email VARCHAR(255) NOT NULL,
          author_name VARCHAR(120) NOT NULL,
          content LONGTEXT NOT NULL,
          created_at BIGINT NOT NULL,
          INDEX idx_collab_project_messages_project (project_id),
          INDEX idx_collab_project_messages_created (created_at)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS collab_project_tasks (
          id VARCHAR(120) PRIMARY KEY,
          project_id VARCHAR(120) NOT NULL,
          content LONGTEXT NOT NULL,
          completed TINYINT(1) NOT NULL DEFAULT 0,
          assignee_name VARCHAR(120) NOT NULL,
          created_at BIGINT NOT NULL,
          INDEX idx_collab_project_tasks_project (project_id),
          INDEX idx_collab_project_tasks_created (created_at)
        )
      `,
    ];

    for (const statement of statements) {
      await pool.query(statement);
    }

    const [shortGenreColumns] = await pool.query(
      "SHOW COLUMNS FROM shorts_items LIKE 'genre'"
    );
    if (shortGenreColumns.length === 0) {
      await pool.query("ALTER TABLE shorts_items ADD COLUMN genre VARCHAR(80) NOT NULL DEFAULT '기타' AFTER creator_email");
    }
  })();

  return schemaReadyPromise;
}

async function mysqlTablesHaveData(tableNames) {
  const pool = getMysqlPool();

  for (const tableName of tableNames) {
    const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM \`${tableName}\``);
    if (toNumber(rows[0]?.count) > 0) {
      return true;
    }
  }

  return false;
}

async function runMysqlWrite(work) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await work(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function queueDomainWrite(label, work) {
  return queueMysqlWrite(async () => {
    await runMysqlWrite(work);
  }, label);
}

async function migrateIfEmpty(tableNames, legacyLoader, saveState) {
  await ensureMysqlSchema();

  if (await mysqlTablesHaveData(tableNames)) {
    return;
  }

  const legacyState = await legacyLoader();
  await runMysqlWrite(async (connection) => {
    await saveState(connection, legacyState);
  });
}

async function readAuthState() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [userRows] = await pool.query(
    `
      SELECT id, email, name, avatar_url, salt, password_hash, created_at
      FROM auth_users
      ORDER BY created_at DESC
    `
  );
  const [resetRows] = await pool.query(
    `
      SELECT id, email, requested_for_existing_user, created_at
      FROM auth_reset_requests
      ORDER BY created_at DESC
    `
  );
  const [sessionRows] = await pool.query(
    `
      SELECT id, token_hash, email, user_id, created_at, last_used_at
      FROM auth_sessions
      ORDER BY last_used_at DESC
    `
  );

  return {
    users: userRows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatar_url || undefined,
      salt: row.salt,
      passwordHash: row.password_hash,
      createdAt: toNumber(row.created_at),
    })),
    resetRequests: resetRows.map((row) => ({
      id: row.id,
      email: row.email,
      exists: Boolean(row.requested_for_existing_user),
      createdAt: toNumber(row.created_at),
    })),
    sessions: sessionRows.map((row) => ({
      id: row.id,
      tokenHash: row.token_hash,
      email: row.email,
      userId: row.user_id,
      createdAt: toNumber(row.created_at),
      lastUsedAt: toNumber(row.last_used_at),
    })),
  };
}

async function replaceAuthState(connection, state) {
  await connection.query('DELETE FROM auth_sessions');
  await connection.query('DELETE FROM auth_reset_requests');
  await connection.query('DELETE FROM auth_users');

  for (const user of state.users ?? []) {
    await connection.execute(
      `
        INSERT INTO auth_users (
          id, email, name, avatar_url, salt, password_hash, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        user.id,
        user.email,
        user.name,
        user.avatarUrl ?? null,
        user.salt,
        user.passwordHash,
        toNumber(user.createdAt, Date.now()),
      ]
    );
  }

  for (const resetRequest of state.resetRequests ?? []) {
    await connection.execute(
      `
        INSERT INTO auth_reset_requests (
          id, email, requested_for_existing_user, created_at
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        resetRequest.id,
        resetRequest.email,
        resetRequest.exists ? 1 : 0,
        toNumber(resetRequest.createdAt, Date.now()),
      ]
    );
  }

  for (const session of state.sessions ?? []) {
    await connection.execute(
      `
        INSERT INTO auth_sessions (
          id, token_hash, email, user_id, created_at, last_used_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        session.id,
        session.tokenHash,
        session.email,
        session.userId,
        toNumber(session.createdAt, Date.now()),
        toNumber(session.lastUsedAt, Date.now()),
      ]
    );
  }
}

export async function loadAuthMysqlState(legacyLoader) {
  await migrateIfEmpty(
    ['auth_users', 'auth_reset_requests', 'auth_sessions'],
    legacyLoader,
    replaceAuthState
  );
  return await readAuthState();
}

export function saveAuthMysqlState(state) {
  queueDomainWrite('auth tables save', async (connection) => {
    await replaceAuthState(connection, state);
  });
}

async function readSettingsState() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `
      SELECT
        email,
        community_notifications,
        music_notifications,
        shorts_notifications,
        collab_notifications,
        profile_public,
        show_activity
      FROM user_settings
    `
  );

  return {
    settingsByEmail: Object.fromEntries(
      rows.map((row) => [
        normalizeEmail(row.email),
        {
          communityNotifications: Boolean(row.community_notifications),
          musicNotifications: Boolean(row.music_notifications),
          shortsNotifications: Boolean(row.shorts_notifications),
          collabNotifications: Boolean(row.collab_notifications),
          profilePublic: Boolean(row.profile_public),
          showActivity: Boolean(row.show_activity),
        },
      ])
    ),
  };
}

async function replaceSettingsState(connection, state) {
  await connection.query('DELETE FROM user_settings');

  for (const [email, settings] of Object.entries(state.settingsByEmail ?? {})) {
    await connection.execute(
      `
        INSERT INTO user_settings (
          email,
          community_notifications,
          music_notifications,
          shorts_notifications,
          collab_notifications,
          profile_public,
          show_activity
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        normalizeEmail(email),
        settings.communityNotifications ? 1 : 0,
        settings.musicNotifications ? 1 : 0,
        settings.shortsNotifications ? 1 : 0,
        settings.collabNotifications ? 1 : 0,
        settings.profilePublic ? 1 : 0,
        settings.showActivity ? 1 : 0,
      ]
    );
  }
}

export async function loadSettingsMysqlState(legacyLoader) {
  await migrateIfEmpty(['user_settings'], legacyLoader, replaceSettingsState);
  return await readSettingsState();
}

export function saveSettingsMysqlState(state) {
  queueDomainWrite('settings tables save', async (connection) => {
    await replaceSettingsState(connection, state);
  });
}

async function readMessagesState() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [friendRows] = await pool.query(
    `
      SELECT owner_email, friend_email, friend_name
      FROM message_friends
      ORDER BY owner_email ASC, friend_name ASC
    `
  );
  const [threadRows] = await pool.query(
    `
      SELECT
        id,
        owner_email,
        type,
        title,
        participant_name,
        participant_email,
        members_json,
        last_message_at,
        last_preview
      FROM message_threads
      ORDER BY last_message_at DESC
    `
  );
  const [messageRows] = await pool.query(
    `
      SELECT
        id,
        thread_id,
        author_name,
        author_email,
        content,
        created_at,
        is_read
      FROM message_items
      ORDER BY created_at ASC
    `
  );

  const friendsByEmail = {};
  friendRows.forEach((row) => {
    const ownerEmail = normalizeEmail(row.owner_email);
    if (!friendsByEmail[ownerEmail]) {
      friendsByEmail[ownerEmail] = [];
    }
    friendsByEmail[ownerEmail].push({
      name: row.friend_name,
      email: normalizeEmail(row.friend_email),
    });
  });

  const threads = threadRows.map((row) => ({
    id: row.id,
    ownerEmail: normalizeEmail(row.owner_email),
    type: row.type,
    title: row.title,
    participantName: row.participant_name ?? undefined,
    participantEmail: row.participant_email ?? undefined,
    members: parseJsonField(row.members_json, []),
    lastMessageAt: toNumber(row.last_message_at),
    lastPreview: row.last_preview,
  }));

  const messagesByThread = {};
  messageRows.forEach((row) => {
    if (!messagesByThread[row.thread_id]) {
      messagesByThread[row.thread_id] = [];
    }

    messagesByThread[row.thread_id].push({
      id: row.id,
      threadId: row.thread_id,
      authorName: row.author_name,
      authorEmail: normalizeEmail(row.author_email),
      content: row.content,
      createdAt: toNumber(row.created_at),
      isRead: Boolean(row.is_read),
    });
  });

  return {
    friendsByEmail,
    threads,
    messagesByThread,
  };
}

async function replaceMessagesState(connection, state) {
  await connection.query('DELETE FROM message_items');
  await connection.query('DELETE FROM message_threads');
  await connection.query('DELETE FROM message_friends');

  for (const [ownerEmail, friends] of Object.entries(state.friendsByEmail ?? {})) {
    for (const friend of friends) {
      await connection.execute(
        `
          INSERT INTO message_friends (
            owner_email, friend_email, friend_name, created_at
          )
          VALUES (?, ?, ?, ?)
        `,
        [normalizeEmail(ownerEmail), normalizeEmail(friend.email), friend.name, 0]
      );
    }
  }

  for (const thread of state.threads ?? []) {
    await connection.execute(
      `
        INSERT INTO message_threads (
          id,
          owner_email,
          type,
          title,
          participant_name,
          participant_email,
          members_json,
          last_message_at,
          last_preview
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        thread.id,
        normalizeEmail(thread.ownerEmail),
        thread.type,
        thread.title,
        thread.participantName ?? null,
        thread.participantEmail ?? null,
        JSON.stringify(thread.members ?? []),
        toNumber(thread.lastMessageAt, Date.now()),
        thread.lastPreview ?? '',
      ]
    );
  }

  for (const messages of Object.values(state.messagesByThread ?? {})) {
    for (const message of messages) {
      await connection.execute(
        `
          INSERT INTO message_items (
            id,
            thread_id,
            author_name,
            author_email,
            content,
            created_at,
            is_read
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          message.id,
          message.threadId,
          message.authorName,
          normalizeEmail(message.authorEmail),
          message.content,
          toNumber(message.createdAt, Date.now()),
          message.isRead ? 1 : 0,
        ]
      );
    }
  }
}

export async function loadMessagesMysqlState(legacyLoader) {
  await migrateIfEmpty(
    ['message_friends', 'message_threads', 'message_items'],
    legacyLoader,
    replaceMessagesState
  );
  return await readMessagesState();
}

export function saveMessagesMysqlState(state) {
  queueDomainWrite('messages tables save', async (connection) => {
    await replaceMessagesState(connection, state);
  });
}

async function readLibraryState() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [projectRows] = await pool.query(
    `
      SELECT
        id,
        title,
        description,
        genre,
        bpm,
        steps,
        created_at,
        updated_at,
        creator_name,
        creator_email,
        project_json,
        export_format,
        is_shared,
        share_visibility,
        share_midi_enabled,
        cover_image_url,
        cover_image_storage_key,
        cover_image_file_name
      FROM library_projects
      ORDER BY created_at DESC
    `
  );
  const [sharedTrackRows] = await pool.query(
    `
      SELECT
        id,
        title,
        progression,
        reference_text,
        category,
        tags_json,
        palette,
        created_at,
        creator_name,
        creator_email,
        image_url
      FROM library_shared_tracks
      ORDER BY created_at DESC
    `
  );
  const [favoriteRows] = await pool.query(
    `
      SELECT user_email, track_id, sort_order
      FROM library_favorites
      ORDER BY user_email ASC, sort_order ASC
    `
  );
  const [likeRows] = await pool.query(
    `
      SELECT user_email, track_id, sort_order
      FROM library_track_likes
      ORDER BY user_email ASC, sort_order ASC
    `
  );
  const [recentRows] = await pool.query(
    `
      SELECT user_email, track_id, sort_order
      FROM library_recent_tracks
      ORDER BY user_email ASC, sort_order ASC
    `
  );
  const [metricRows] = await pool.query(
    `
      SELECT track_id, like_count, view_count, download_count
      FROM library_track_metrics
    `
  );
  const [commentRows] = await pool.query(
    `
      SELECT id, track_id, author_name, author_email, content, created_at
      FROM library_track_comments
      ORDER BY created_at DESC
    `
  );

  const favoriteTrackIdsByUser = {};
  favoriteRows.forEach((row) => {
    const email = normalizeEmail(row.user_email);
    if (!favoriteTrackIdsByUser[email]) {
      favoriteTrackIdsByUser[email] = [];
    }
    favoriteTrackIdsByUser[email].push(row.track_id);
  });

  const likedTrackIdsByUser = {};
  likeRows.forEach((row) => {
    const email = normalizeEmail(row.user_email);
    if (!likedTrackIdsByUser[email]) {
      likedTrackIdsByUser[email] = [];
    }
    likedTrackIdsByUser[email].push(row.track_id);
  });

  const recentOpenedTrackIdsByUser = {};
  recentRows.forEach((row) => {
    const email = normalizeEmail(row.user_email);
    if (!recentOpenedTrackIdsByUser[email]) {
      recentOpenedTrackIdsByUser[email] = [];
    }
    recentOpenedTrackIdsByUser[email].push(row.track_id);
  });

    return {
      projects: projectRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      genre: row.genre,
      bpm: toNumber(row.bpm, 120),
      steps: toNumber(row.steps, 32),
      createdAt: toNumber(row.created_at),
      updatedAt: toNumber(row.updated_at),
      creatorName: row.creator_name,
      creatorEmail: normalizeEmail(row.creator_email),
      project: parseJsonField(row.project_json, null),
      exportFormat: row.export_format,
      isShared: Boolean(row.is_shared),
      shareVisibility: row.share_visibility,
      shareMidiEnabled: Boolean(row.share_midi_enabled),
      coverImageUrl: row.cover_image_url ?? undefined,
      coverImageStorageKey: row.cover_image_storage_key ?? undefined,
      coverImageFileName: row.cover_image_file_name ?? undefined,
      })),
      sharedTracks: sharedTrackRows.map((row) => ({
        id: row.id,
        title: row.title,
        progression: row.progression,
        reference: row.reference_text,
        category: row.category,
        tags: parseJsonField(row.tags_json, []),
        palette: row.palette,
        createdAt: toNumber(row.created_at),
        creatorName: row.creator_name,
        creatorEmail: normalizeEmail(row.creator_email),
        imageUrl: row.image_url ?? undefined,
      })),
      favoriteTrackIdsByUser,
    likedTrackIdsByUser,
    recentOpenedTrackIdsByUser,
    trackMetricsById: Object.fromEntries(
      metricRows.map((row) => [
        row.track_id,
        {
          likeCount: toNumber(row.like_count),
          viewCount: toNumber(row.view_count),
          downloadCount: toNumber(row.download_count),
        },
      ])
    ),
    comments: commentRows.map((row) => ({
      id: row.id,
      trackId: row.track_id,
      authorName: row.author_name,
      authorEmail: normalizeEmail(row.author_email),
      content: row.content,
      createdAt: toNumber(row.created_at),
    })),
  };
}

async function replaceLibraryState(connection, state) {
  await connection.query('DELETE FROM library_track_comments');
  await connection.query('DELETE FROM library_recent_tracks');
  await connection.query('DELETE FROM library_track_likes');
  await connection.query('DELETE FROM library_favorites');
  await connection.query('DELETE FROM library_track_metrics');
  await connection.query('DELETE FROM library_shared_tracks');
  await connection.query('DELETE FROM library_projects');

  for (const project of state.projects ?? []) {
    await connection.execute(
      `
        INSERT INTO library_projects (
          id,
          title,
          description,
          genre,
          bpm,
          steps,
          created_at,
          updated_at,
          creator_name,
          creator_email,
          project_json,
          export_format,
          is_shared,
          share_visibility,
          share_midi_enabled,
          cover_image_url,
          cover_image_storage_key,
          cover_image_file_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        project.id,
        project.title,
        project.description ?? '',
        project.genre ?? '미정',
        toNumber(project.bpm, 120),
        toNumber(project.steps, 32),
        toNumber(project.createdAt, Date.now()),
        toNumber(project.updatedAt, Date.now()),
        project.creatorName ?? 'guest',
        normalizeEmail(project.creatorEmail) || 'guest@songmaker.local',
        JSON.stringify(project.project ?? null),
        project.exportFormat ?? 'wav',
        project.isShared ? 1 : 0,
        project.shareVisibility ?? 'private',
        project.shareMidiEnabled ? 1 : 0,
        project.coverImageUrl ?? null,
        project.coverImageStorageKey ?? null,
        project.coverImageFileName ?? null,
      ]
    );
  }

  for (const track of state.sharedTracks ?? []) {
    await connection.execute(
      `
        INSERT INTO library_shared_tracks (
          id,
          title,
          progression,
          reference_text,
          category,
          tags_json,
          palette,
          created_at,
          creator_name,
          creator_email,
          image_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        track.id,
        track.title ?? '공유 트랙',
        track.progression ?? '',
        track.reference ?? '',
        track.category ?? 'pop',
        JSON.stringify(track.tags ?? []),
        track.palette ?? '',
        toNumber(track.createdAt, Date.now()),
        track.creatorName ?? 'guest',
        normalizeEmail(track.creatorEmail) || 'guest@songmaker.local',
        track.imageUrl ?? null,
      ]
    );
  }

  for (const [email, trackIds] of Object.entries(state.favoriteTrackIdsByUser ?? {})) {
    for (const [index, trackId] of trackIds.entries()) {
      await connection.execute(
        `
          INSERT INTO library_favorites (user_email, track_id, sort_order)
          VALUES (?, ?, ?)
        `,
        [normalizeEmail(email), trackId, index]
      );
    }
  }

  for (const [email, trackIds] of Object.entries(state.likedTrackIdsByUser ?? {})) {
    for (const [index, trackId] of trackIds.entries()) {
      await connection.execute(
        `
          INSERT INTO library_track_likes (user_email, track_id, sort_order)
          VALUES (?, ?, ?)
        `,
        [normalizeEmail(email), trackId, index]
      );
    }
  }

  for (const [email, trackIds] of Object.entries(state.recentOpenedTrackIdsByUser ?? {})) {
    for (const [index, trackId] of trackIds.entries()) {
      await connection.execute(
        `
          INSERT INTO library_recent_tracks (user_email, track_id, sort_order)
          VALUES (?, ?, ?)
        `,
        [normalizeEmail(email), trackId, index]
      );
    }
  }

  for (const [trackId, metrics] of Object.entries(state.trackMetricsById ?? {})) {
    await connection.execute(
      `
        INSERT INTO library_track_metrics (
          track_id, like_count, view_count, download_count
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        trackId,
        toNumber(metrics.likeCount),
        toNumber(metrics.viewCount),
        toNumber(metrics.downloadCount),
      ]
    );
  }

  for (const comment of state.comments ?? []) {
    await connection.execute(
      `
        INSERT INTO library_track_comments (
          id, track_id, author_name, author_email, content, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        comment.id,
        comment.trackId,
        comment.authorName ?? 'guest',
        normalizeEmail(comment.authorEmail) || 'guest@songmaker.local',
        comment.content ?? '',
        toNumber(comment.createdAt, Date.now()),
      ]
    );
  }
}

export async function loadLibraryMysqlState(legacyLoader) {
  await migrateIfEmpty(
    [
        'library_projects',
        'library_shared_tracks',
        'library_favorites',
      'library_track_likes',
      'library_recent_tracks',
      'library_track_metrics',
      'library_track_comments',
    ],
    legacyLoader,
    replaceLibraryState
  );
  return await readLibraryState();
}

export function saveLibraryMysqlState(state) {
  queueDomainWrite('library tables save', async (connection) => {
    await replaceLibraryState(connection, state);
  });
}

async function readCommunityState() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [postRows] = await pool.query(
    `
      SELECT
        id,
        title,
        content,
        author_id,
        author_name,
        created_at,
        like_count,
        category,
        comment_count,
        view_count,
        is_hot,
        tags_json
      FROM community_posts
      ORDER BY created_at DESC
    `
  );
  const [commentRows] = await pool.query(
    `
      SELECT
        id,
        post_id,
        parent_id,
        content,
        author_name,
        author_email,
        created_at,
        like_count
      FROM community_comments
      ORDER BY created_at DESC
    `
  );
  const [likeRows] = await pool.query(
    `
      SELECT user_email, post_id
      FROM community_post_likes
      ORDER BY created_at DESC
    `
  );
  const [bookmarkRows] = await pool.query(
    `
      SELECT user_email, post_id
      FROM community_post_bookmarks
      ORDER BY created_at DESC
    `
  );
  const [reportRows] = await pool.query(
    `
      SELECT user_email, post_id
      FROM community_post_reports
      ORDER BY created_at DESC
    `
  );
  const [blockedRows] = await pool.query(
    `
      SELECT author_email
      FROM community_blocked_authors
      ORDER BY blocked_at DESC
    `
  );

  const likedPostIdsByUser = {};
  likeRows.forEach((row) => {
    const email = normalizeEmail(row.user_email);
    if (!likedPostIdsByUser[email]) {
      likedPostIdsByUser[email] = [];
    }
    likedPostIdsByUser[email].push(row.post_id);
  });

  const bookmarkedPostIdsByUser = {};
  bookmarkRows.forEach((row) => {
    const email = normalizeEmail(row.user_email);
    if (!bookmarkedPostIdsByUser[email]) {
      bookmarkedPostIdsByUser[email] = [];
    }
    bookmarkedPostIdsByUser[email].push(row.post_id);
  });

  const reportedPostIdsByUser = {};
  reportRows.forEach((row) => {
    const email = normalizeEmail(row.user_email);
    if (!reportedPostIdsByUser[email]) {
      reportedPostIdsByUser[email] = [];
    }
    reportedPostIdsByUser[email].push(row.post_id);
  });

  return {
    posts: postRows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      authorId: normalizeEmail(row.author_id),
      authorName: row.author_name,
      createdAt: toNumber(row.created_at),
      likeCount: toNumber(row.like_count),
      category: row.category,
      commentCount: toNumber(row.comment_count),
      viewCount: toNumber(row.view_count),
      isHot: Boolean(row.is_hot),
      tags: parseJsonField(row.tags_json, []),
    })),
    comments: commentRows.map((row) => ({
      id: row.id,
      postId: row.post_id,
      parentId: row.parent_id ?? null,
      content: row.content,
      authorName: row.author_name,
      authorEmail: normalizeEmail(row.author_email),
      createdAt: toNumber(row.created_at),
      likeCount: toNumber(row.like_count),
    })),
    likedPostIdsByUser,
    bookmarkedPostIdsByUser,
    reportedPostIdsByUser,
    blockedAuthorEmails: blockedRows.map((row) => normalizeEmail(row.author_email)).filter(Boolean),
  };
}

async function replaceCommunityState(connection, state) {
  await connection.query('DELETE FROM community_post_reports');
  await connection.query('DELETE FROM community_post_bookmarks');
  await connection.query('DELETE FROM community_post_likes');
  await connection.query('DELETE FROM community_comments');
  await connection.query('DELETE FROM community_blocked_authors');
  await connection.query('DELETE FROM community_posts');

  for (const post of state.posts ?? []) {
    await connection.execute(
      `
        INSERT INTO community_posts (
          id,
          title,
          content,
          author_id,
          author_name,
          created_at,
          like_count,
          category,
          comment_count,
          view_count,
          is_hot,
          tags_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        post.id,
        post.title,
        post.content ?? '',
        normalizeEmail(post.authorId),
        post.authorName ?? 'guest',
        toNumber(post.createdAt, Date.now()),
        toNumber(post.likeCount),
        post.category ?? '질문',
        toNumber(post.commentCount),
        toNumber(post.viewCount),
        post.isHot ? 1 : 0,
        JSON.stringify(post.tags ?? []),
      ]
    );
  }

  for (const comment of state.comments ?? []) {
    await connection.execute(
      `
        INSERT INTO community_comments (
          id,
          post_id,
          parent_id,
          content,
          author_name,
          author_email,
          created_at,
          like_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        comment.id,
        comment.postId,
        comment.parentId ?? null,
        comment.content ?? '',
        comment.authorName ?? 'guest',
        normalizeEmail(comment.authorEmail) || 'guest@songmaker.local',
        toNumber(comment.createdAt, Date.now()),
        toNumber(comment.likeCount),
      ]
    );
  }

  for (const [email, postIds] of Object.entries(state.likedPostIdsByUser ?? {})) {
    for (const postId of postIds) {
      await connection.execute(
        `
          INSERT INTO community_post_likes (user_email, post_id, created_at)
          VALUES (?, ?, ?)
        `,
        [normalizeEmail(email), postId, Date.now()]
      );
    }
  }

  for (const [email, postIds] of Object.entries(state.bookmarkedPostIdsByUser ?? {})) {
    for (const postId of postIds) {
      await connection.execute(
        `
          INSERT INTO community_post_bookmarks (user_email, post_id, created_at)
          VALUES (?, ?, ?)
        `,
        [normalizeEmail(email), postId, Date.now()]
      );
    }
  }

  for (const [email, postIds] of Object.entries(state.reportedPostIdsByUser ?? {})) {
    for (const postId of postIds) {
      await connection.execute(
        `
          INSERT INTO community_post_reports (user_email, post_id, created_at)
          VALUES (?, ?, ?)
        `,
        [normalizeEmail(email), postId, Date.now()]
      );
    }
  }

  for (const blockedEmail of state.blockedAuthorEmails ?? []) {
    await connection.execute(
      `
        INSERT INTO community_blocked_authors (author_email, blocked_at)
        VALUES (?, ?)
      `,
      [normalizeEmail(blockedEmail), Date.now()]
    );
  }
}

export async function loadCommunityMysqlState(legacyLoader) {
  await migrateIfEmpty(
    [
      'community_posts',
      'community_comments',
      'community_post_likes',
      'community_post_bookmarks',
      'community_post_reports',
      'community_blocked_authors',
    ],
    legacyLoader,
    replaceCommunityState
  );
  return await readCommunityState();
}

export function saveCommunityMysqlState(state) {
  queueDomainWrite('community tables save', async (connection) => {
    await replaceCommunityState(connection, state);
  });
}

async function readMarketState() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [itemRows] = await pool.query(
    `
      SELECT
        id,
        title,
        brand,
        category,
        status,
        trade_type,
        item_condition,
        location,
        price,
        created_at,
        updated_at,
        urgent,
        palette,
        seller_name,
        seller_email,
        description,
        favorite_count,
        view_count,
        image_url,
        image_storage_key,
        image_file_name
      FROM market_items
      ORDER BY created_at DESC
    `
  );
  const [favoriteRows] = await pool.query(
    `
      SELECT user_email, item_id, sort_order
      FROM market_favorites
      ORDER BY user_email ASC, sort_order ASC
    `
  );

  const favoriteItemIdsByUser = {};
  favoriteRows.forEach((row) => {
    const email = normalizeEmail(row.user_email);
    if (!favoriteItemIdsByUser[email]) {
      favoriteItemIdsByUser[email] = [];
    }
    favoriteItemIdsByUser[email].push(row.item_id);
  });

  return {
    items: itemRows.map((row) => ({
      id: row.id,
      title: row.title,
      brand: row.brand,
      category: row.category,
      status: row.status,
      tradeType: row.trade_type,
      condition: row.item_condition,
      location: row.location,
      price: toNumber(row.price),
      createdAt: toNumber(row.created_at),
      updatedAt: toNumber(row.updated_at),
      urgent: Boolean(row.urgent),
      palette: row.palette,
      sellerName: row.seller_name,
      sellerEmail: normalizeEmail(row.seller_email),
      description: row.description,
      favoriteCount: toNumber(row.favorite_count),
      viewCount: toNumber(row.view_count),
      imageUrl: row.image_url ?? undefined,
      imageStorageKey: row.image_storage_key ?? undefined,
      imageFileName: row.image_file_name ?? undefined,
    })),
    favoriteItemIdsByUser,
  };
}

async function replaceMarketState(connection, state) {
  await connection.query('DELETE FROM market_favorites');
  await connection.query('DELETE FROM market_items');

  for (const item of state.items ?? []) {
    await connection.execute(
      `
        INSERT INTO market_items (
          id,
          title,
          brand,
          category,
          status,
          trade_type,
          item_condition,
          location,
          price,
          created_at,
          updated_at,
          urgent,
          palette,
          seller_name,
          seller_email,
          description,
          favorite_count,
          view_count,
          image_url,
          image_storage_key,
          image_file_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        item.id,
        item.title ?? '?? ??',
        item.brand ?? '??? ??',
        item.category ?? 'etc',
        item.status ?? 'sale',
        item.tradeType ?? 'both',
        item.condition ?? '?',
        item.location ?? '?? ??',
        toNumber(item.price),
        toNumber(item.createdAt, Date.now()),
        toNumber(item.updatedAt, Date.now()),
        item.urgent ? 1 : 0,
        item.palette ?? '',
        item.sellerName ?? 'guest',
        normalizeEmail(item.sellerEmail) || 'guest@songmaker.local',
        item.description ?? '',
        toNumber(item.favoriteCount),
        toNumber(item.viewCount),
        item.imageUrl ?? null,
        item.imageStorageKey ?? null,
        item.imageFileName ?? null
      ]
    );
  }

  for (const [email, itemIds] of Object.entries(state.favoriteItemIdsByUser ?? {})) {
    for (const [index, itemId] of itemIds.entries()) {
      await connection.execute(
        `
          INSERT INTO market_favorites (user_email, item_id, sort_order)
          VALUES (?, ?, ?)
        `,
        [normalizeEmail(email), itemId, index]
      );
    }
  }
}

export async function loadMarketMysqlState(legacyLoader) {
  await migrateIfEmpty(['market_items', 'market_favorites'], legacyLoader, replaceMarketState);
  return await readMarketState();
}

export function saveMarketMysqlState(state) {
  queueDomainWrite('market tables save', async (connection) => {
    await replaceMarketState(connection, state);
  });
}

async function readSessionRecruitState() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        title,
        genre,
        host_name,
        host_email,
        summary,
        location,
        region,
        meeting_type,
        status,
        wanted_roles_json,
        tags_json,
        current_members,
        max_members,
        schedule_label,
        urgent,
        created_at,
        updated_at
      FROM session_recruit_posts
      ORDER BY updated_at DESC, created_at DESC
    `
  );

  return {
    posts: rows.map((row) => ({
      id: row.id,
      title: row.title,
      genre: row.genre,
      hostName: row.host_name,
      hostEmail: normalizeEmail(row.host_email),
      summary: row.summary,
      location: row.location,
      region: row.region,
      meetingType: row.meeting_type,
      status: row.status,
      wantedRoles: parseJsonField(row.wanted_roles_json, []),
      tags: parseJsonField(row.tags_json, []),
      currentMembers: toNumber(row.current_members, 1),
      maxMembers: toNumber(row.max_members, 4),
      schedule: row.schedule_label,
      urgent: Boolean(row.urgent),
      createdAt: toNumber(row.created_at, Date.now()),
      updatedAt: toNumber(row.updated_at, Date.now()),
    })),
  };
}

async function replaceSessionRecruitState(connection, state) {
  await connection.query('DELETE FROM session_recruit_posts');

  for (const post of state.posts ?? []) {
    await connection.execute(
      `
        INSERT INTO session_recruit_posts (
          id,
          title,
          genre,
          host_name,
          host_email,
          summary,
          location,
          region,
          meeting_type,
          status,
          wanted_roles_json,
          tags_json,
          current_members,
          max_members,
          schedule_label,
          urgent,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        post.id,
        post.title ?? '새 세션 모집',
        post.genre ?? '미정',
        post.hostName ?? 'guest',
        normalizeEmail(post.hostEmail) || 'guest@songmaker.local',
        post.summary ?? '',
        post.location ?? '온라인',
        post.region ?? 'online',
        post.meetingType ?? '온라인',
        post.status ?? 'open',
        JSON.stringify(post.wantedRoles ?? []),
        JSON.stringify(post.tags ?? []),
        toNumber(post.currentMembers, 1),
        toNumber(post.maxMembers, 4),
        post.schedule ?? '일정 협의',
        post.urgent ? 1 : 0,
        toNumber(post.createdAt, Date.now()),
        toNumber(post.updatedAt, Date.now()),
      ]
    );
  }
}

export async function loadSessionRecruitMysqlState(legacyLoader) {
  await migrateIfEmpty(['session_recruit_posts'], legacyLoader, replaceSessionRecruitState);
  return await readSessionRecruitState();
}

export function saveSessionRecruitMysqlState(state) {
  queueDomainWrite('session recruit tables save', async (connection) => {
    await replaceSessionRecruitState(connection, state);
  });
}

async function readLearnState() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [completedRows] = await pool.query(
    `
      SELECT user_key, lesson_id
      FROM learn_completed_lessons
      ORDER BY user_key ASC, lesson_id ASC
    `
  );
  const [favoriteRows] = await pool.query(
    `
      SELECT user_key, lesson_id
      FROM learn_favorite_lessons
      ORDER BY user_key ASC, lesson_id ASC
    `
  );
  const [quizRows] = await pool.query(
    `
      SELECT user_key, lesson_id, selected_index, is_correct, answered_at
      FROM learn_quiz_answers
      ORDER BY answered_at DESC
    `
  );

  const completedByUser = {};
  completedRows.forEach((row) => {
    const userKey = String(row.user_key || '').trim().toLowerCase();
    if (!completedByUser[userKey]) {
      completedByUser[userKey] = [];
    }
    completedByUser[userKey].push(row.lesson_id);
  });

  const favoriteByUser = {};
  favoriteRows.forEach((row) => {
    const userKey = String(row.user_key || '').trim().toLowerCase();
    if (!favoriteByUser[userKey]) {
      favoriteByUser[userKey] = [];
    }
    favoriteByUser[userKey].push(row.lesson_id);
  });

  const quizAnswersByUser = {};
  quizRows.forEach((row) => {
    const userKey = String(row.user_key || '').trim().toLowerCase();
    if (!quizAnswersByUser[userKey]) {
      quizAnswersByUser[userKey] = {};
    }
    quizAnswersByUser[userKey][row.lesson_id] = {
      selectedIndex: toNumber(row.selected_index),
      isCorrect: Boolean(row.is_correct),
      answeredAt: toNumber(row.answered_at),
    };
  });

  return {
    completedByUser,
    favoriteByUser,
    quizAnswersByUser,
  };
}

async function replaceLearnState(connection, state) {
  await connection.query('DELETE FROM learn_quiz_answers');
  await connection.query('DELETE FROM learn_favorite_lessons');
  await connection.query('DELETE FROM learn_completed_lessons');

  for (const [userKey, lessonIds] of Object.entries(state.completedByUser ?? {})) {
    for (const lessonId of lessonIds) {
      await connection.execute(
        `
          INSERT INTO learn_completed_lessons (user_key, lesson_id)
          VALUES (?, ?)
        `,
        [String(userKey).trim().toLowerCase(), lessonId]
      );
    }
  }

  for (const [userKey, lessonIds] of Object.entries(state.favoriteByUser ?? {})) {
    for (const lessonId of lessonIds) {
      await connection.execute(
        `
          INSERT INTO learn_favorite_lessons (user_key, lesson_id)
          VALUES (?, ?)
        `,
        [String(userKey).trim().toLowerCase(), lessonId]
      );
    }
  }

  for (const [userKey, answers] of Object.entries(state.quizAnswersByUser ?? {})) {
    for (const [lessonId, answer] of Object.entries(answers ?? {})) {
      await connection.execute(
        `
          INSERT INTO learn_quiz_answers (
            user_key, lesson_id, selected_index, is_correct, answered_at
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          String(userKey).trim().toLowerCase(),
          lessonId,
          toNumber(answer.selectedIndex),
          answer.isCorrect ? 1 : 0,
          toNumber(answer.answeredAt, Date.now()),
        ]
      );
    }
  }
}

export async function loadLearnMysqlState(legacyLoader) {
  await migrateIfEmpty(
    ['learn_completed_lessons', 'learn_favorite_lessons', 'learn_quiz_answers'],
    legacyLoader,
    replaceLearnState
  );
  return await readLearnState();
}

export function saveLearnMysqlState(state) {
  queueDomainWrite('learn tables save', async (connection) => {
    await replaceLearnState(connection, state);
  });
}

async function readShortsState() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [shortRows] = await pool.query(
    `
      SELECT
        id,
        title,
        description,
        creator_name,
        creator_email,
        genre,
        tags_json,
        created_at,
        duration_label,
        like_count,
        view_count,
        visibility,
        tone,
        video_url,
        video_storage_key,
        video_file_name,
        video_size_bytes
      FROM shorts_items
      ORDER BY created_at DESC
    `
  );
  const [commentRows] = await pool.query(
    `
      SELECT id, short_id, author_name, author_email, content, created_at
      FROM shorts_comments
      ORDER BY created_at DESC
    `
  );
  const [likeRows] = await pool.query(
    `
      SELECT short_id, user_email
      FROM shorts_likes
      ORDER BY created_at DESC
    `
  );

  const likedByShortId = {};
  likeRows.forEach((row) => {
    if (!likedByShortId[row.short_id]) {
      likedByShortId[row.short_id] = [];
    }
    likedByShortId[row.short_id].push(normalizeEmail(row.user_email));
  });

  return {
    shorts: shortRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      creatorName: row.creator_name,
      creatorEmail: normalizeEmail(row.creator_email),
      genre: row.genre || '기타',
      tags: parseJsonField(row.tags_json, []),
      createdAt: toNumber(row.created_at),
      durationLabel: row.duration_label,
      likeCount: toNumber(row.like_count),
      viewCount: toNumber(row.view_count),
      visibility: row.visibility,
      tone: row.tone,
      likedBy: likedByShortId[row.id] ?? [],
      videoUrl: row.video_url ?? undefined,
      videoStorageKey: row.video_storage_key ?? undefined,
      videoFileName: row.video_file_name ?? undefined,
      videoSizeBytes: row.video_size_bytes == null ? undefined : toNumber(row.video_size_bytes),
    })),
    comments: commentRows.map((row) => ({
      id: row.id,
      shortId: row.short_id,
      authorName: row.author_name,
      authorEmail: normalizeEmail(row.author_email),
      content: row.content,
      createdAt: toNumber(row.created_at),
    })),
  };
}

async function replaceShortsState(connection, state) {
  await connection.query('DELETE FROM shorts_likes');
  await connection.query('DELETE FROM shorts_comments');
  await connection.query('DELETE FROM shorts_items');

  for (const short of state.shorts ?? []) {
    await connection.execute(
      `
        INSERT INTO shorts_items (
          id,
          title,
          description,
          creator_name,
          creator_email,
          genre,
          tags_json,
          created_at,
          duration_label,
          like_count,
          view_count,
          visibility,
          tone,
          video_url,
          video_storage_key,
          video_file_name,
          video_size_bytes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        short.id,
        short.title,
        short.description ?? '',
        short.creatorName ?? 'guest',
        normalizeEmail(short.creatorEmail) || 'guest@songmaker.local',
        short.genre ?? '기타',
        JSON.stringify(short.tags ?? []),
        toNumber(short.createdAt, Date.now()),
        short.durationLabel ?? '0:15',
        toNumber(short.likeCount),
        toNumber(short.viewCount),
        short.visibility ?? 'public',
        short.tone ?? 'lime',
        short.videoUrl ?? null,
        short.videoStorageKey ?? null,
        short.videoFileName ?? null,
        short.videoSizeBytes == null ? null : toNumber(short.videoSizeBytes),
      ]
    );

    for (const email of short.likedBy ?? []) {
      await connection.execute(
        `
          INSERT INTO shorts_likes (short_id, user_email, created_at)
          VALUES (?, ?, ?)
        `,
        [short.id, normalizeEmail(email), Date.now()]
      );
    }
  }

  for (const comment of state.comments ?? []) {
    await connection.execute(
      `
        INSERT INTO shorts_comments (
          id, short_id, author_name, author_email, content, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        comment.id,
        comment.shortId,
        comment.authorName ?? 'guest',
        normalizeEmail(comment.authorEmail) || 'guest@songmaker.local',
        comment.content ?? '',
        toNumber(comment.createdAt, Date.now()),
      ]
    );
  }
}

export async function loadShortsMysqlState(legacyLoader) {
  await migrateIfEmpty(
    ['shorts_items', 'shorts_comments', 'shorts_likes'],
    legacyLoader,
    replaceShortsState
  );
  return await readShortsState();
}

export function saveShortsMysqlState(state) {
  queueDomainWrite('shorts tables save', async (connection) => {
    await replaceShortsState(connection, state);
  });
}

async function readCollabState() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [projectRows] = await pool.query(
    `
      SELECT
        id,
        title,
        summary,
        genre,
        bpm,
        steps,
        status,
        created_at,
        updated_at,
        owner_email,
        owner_name,
        source_project_id,
        tags_json,
        snapshot_json,
        snapshot_revision,
        snapshot_updated_by_email,
        snapshot_updated_by_session_id
      FROM collab_projects
      ORDER BY updated_at DESC
    `
  );
  const [memberRows] = await pool.query(
    `
      SELECT project_id, email, name, role, joined_at
      FROM collab_project_members
      ORDER BY joined_at ASC
    `
  );
  const [messageRows] = await pool.query(
    `
      SELECT id, project_id, author_email, author_name, content, created_at
      FROM collab_project_messages
      ORDER BY created_at DESC
    `
  );
  const [taskRows] = await pool.query(
    `
      SELECT id, project_id, content, completed, assignee_name, created_at
      FROM collab_project_tasks
      ORDER BY created_at DESC
    `
  );

  const membersByProject = {};
  memberRows.forEach((row) => {
    if (!membersByProject[row.project_id]) {
      membersByProject[row.project_id] = [];
    }
    membersByProject[row.project_id].push({
      email: normalizeEmail(row.email),
      name: row.name,
      role: row.role,
      joinedAt: toNumber(row.joined_at),
    });
  });

  const projects = projectRows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    genre: row.genre,
    bpm: toNumber(row.bpm, 120),
    steps: toNumber(row.steps, 32),
    status: row.status,
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at),
    ownerEmail: normalizeEmail(row.owner_email),
    ownerName: row.owner_name,
    sourceProjectId: row.source_project_id ?? null,
    tags: parseJsonField(row.tags_json, []),
    members: membersByProject[row.id] ?? [],
    snapshot: parseJsonField(row.snapshot_json, null),
    snapshotRevision: toNumber(row.snapshot_revision),
    snapshotUpdatedByEmail: row.snapshot_updated_by_email ?? null,
    snapshotUpdatedBySessionId: row.snapshot_updated_by_session_id ?? null,
  }));

  const latestProjectTimestamp = projects.reduce(
    (maxValue, project) => Math.max(maxValue, toNumber(project.updatedAt)),
    0
  );
  const latestMessageTimestamp = messageRows.reduce(
    (maxValue, message) => Math.max(maxValue, toNumber(message.created_at)),
    0
  );
  const latestTaskTimestamp = taskRows.reduce(
    (maxValue, task) => Math.max(maxValue, toNumber(task.created_at)),
    0
  );

  return {
    version: Math.max(latestProjectTimestamp, latestMessageTimestamp, latestTaskTimestamp, Date.now()),
    projects,
    messages: messageRows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      authorEmail: normalizeEmail(row.author_email),
      authorName: row.author_name,
      content: row.content,
      createdAt: toNumber(row.created_at),
    })),
    tasks: taskRows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      content: row.content,
      completed: Boolean(row.completed),
      assigneeName: row.assignee_name,
      createdAt: toNumber(row.created_at),
    })),
  };
}

async function replaceCollabState(connection, state) {
  await connection.query('DELETE FROM collab_project_tasks');
  await connection.query('DELETE FROM collab_project_messages');
  await connection.query('DELETE FROM collab_project_members');
  await connection.query('DELETE FROM collab_projects');

  for (const project of state.projects ?? []) {
    await connection.execute(
      `
        INSERT INTO collab_projects (
          id,
          title,
          summary,
          genre,
          bpm,
          steps,
          status,
          created_at,
          updated_at,
          owner_email,
          owner_name,
          source_project_id,
          tags_json,
          snapshot_json,
          snapshot_revision,
          snapshot_updated_by_email,
          snapshot_updated_by_session_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        project.id,
        project.title,
        project.summary ?? '',
        project.genre ?? '미정',
        toNumber(project.bpm, 120),
        toNumber(project.steps, 32),
        project.status ?? 'planning',
        toNumber(project.createdAt, Date.now()),
        toNumber(project.updatedAt, Date.now()),
        normalizeEmail(project.ownerEmail) || 'guest@songmaker.local',
        project.ownerName ?? 'guest',
        project.sourceProjectId ?? null,
        JSON.stringify(project.tags ?? []),
        project.snapshot == null ? null : JSON.stringify(project.snapshot),
        toNumber(project.snapshotRevision),
        project.snapshotUpdatedByEmail ?? null,
        project.snapshotUpdatedBySessionId ?? null,
      ]
    );

    for (const member of project.members ?? []) {
      await connection.execute(
        `
          INSERT INTO collab_project_members (
            project_id, email, name, role, joined_at
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          project.id,
          normalizeEmail(member.email) || 'guest@songmaker.local',
          member.name ?? 'guest',
          member.role ?? 'viewer',
          toNumber(member.joinedAt, Date.now()),
        ]
      );
    }
  }

  for (const message of state.messages ?? []) {
    await connection.execute(
      `
        INSERT INTO collab_project_messages (
          id, project_id, author_email, author_name, content, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        message.id,
        message.projectId,
        normalizeEmail(message.authorEmail) || 'guest@songmaker.local',
        message.authorName ?? 'guest',
        message.content ?? '',
        toNumber(message.createdAt, Date.now()),
      ]
    );
  }

  for (const task of state.tasks ?? []) {
    await connection.execute(
      `
        INSERT INTO collab_project_tasks (
          id, project_id, content, completed, assignee_name, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        task.id,
        task.projectId,
        task.content ?? '',
        task.completed ? 1 : 0,
        task.assigneeName ?? '담당 미정',
        toNumber(task.createdAt, Date.now()),
      ]
    );
  }
}

export async function loadCollabMysqlState(legacyLoader) {
  await migrateIfEmpty(
    [
      'collab_projects',
      'collab_project_members',
      'collab_project_messages',
      'collab_project_tasks',
    ],
    legacyLoader,
    replaceCollabState
  );
  return await readCollabState();
}

export function saveCollabMysqlState(state) {
  queueDomainWrite('collab tables save', async (connection) => {
    await replaceCollabState(connection, state);
  });
}
