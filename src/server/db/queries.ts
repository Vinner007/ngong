// Every SQL statement the app runs, named after what it does.
// All values are passed as `?` bindings, never concatenated into the SQL text.

// ---------- room ----------

export const SELECT_ROOM = `
  SELECT code, title, host_token_hash, device_salt, status, demo_audience, created_at, expires_at
  FROM room
  WHERE id = 1`

export const INSERT_ROOM = `
  INSERT INTO room (id, code, title, host_token_hash, device_salt, created_at, expires_at)
  VALUES (1, ?, ?, ?, ?, ?, ?)`

export const UPDATE_ROOM_STATUS = `UPDATE room SET status = ? WHERE id = 1`

export const UPDATE_ROOM_DEMO_AUDIENCE = `UPDATE room SET demo_audience = ? WHERE id = 1`

// ---------- questions ----------

/** Rate limit: when did this device last ask? Uses question_by_device. */
export const SELECT_LAST_ASK_BY_DEVICE = `
  SELECT created_at
  FROM question
  WHERE device_hash = ?
  ORDER BY created_at DESC
  LIMIT 1`

export const COUNT_QUESTIONS = `SELECT COUNT(*) AS count FROM question`

export const COUNT_QUESTIONS_BY_STATUS = `
  SELECT status, COUNT(*) AS count
  FROM question
  GROUP BY status`

export const INSERT_QUESTION = `
  INSERT INTO question (device_hash, body, created_at)
  VALUES (?, ?, ?)
  RETURNING id`

/** Work queue for the embedding step. Uses question_to_embed. */
export const SELECT_QUESTIONS_TO_EMBED = `
  SELECT id, device_hash, body, attempts
  FROM question
  WHERE status = 'pending' OR (status = 'failed' AND attempts < ?)
  ORDER BY created_at
  LIMIT ?`

export const SELECT_QUESTION_STATUS = `SELECT status FROM question WHERE id = ?`

export const MARK_QUESTION_CLUSTERED = `
  UPDATE question
  SET status = 'clustered', topic_id = ?, embedding = ?
  WHERE id = ?`

export const MARK_QUESTION_FAILED = `
  UPDATE question
  SET status = 'failed', attempts = attempts + 1
  WHERE id = ?`

export const SELECT_QUESTION_FOR_HIDE = `
  SELECT id, topic_id, device_hash, embedding, status
  FROM question
  WHERE id = ?`

export const MARK_QUESTION_HIDDEN = `UPDATE question SET status = 'hidden' WHERE id = ?`

/** Does this device still have a visible question in the topic? Uses question_by_topic. */
export const COUNT_CLUSTERED_BY_DEVICE_IN_TOPIC = `
  SELECT COUNT(*) AS count
  FROM question
  WHERE topic_id = ? AND status = 'clustered' AND device_hash = ?`

/** Raw questions of one topic, host only. Uses question_by_topic. */
export const SELECT_TOPIC_QUESTIONS = `
  SELECT id, body, embedding, created_at
  FROM question
  WHERE topic_id = ? AND status = 'clustered'
  ORDER BY created_at DESC
  LIMIT ?`

/** The host's "all questions" tab. Uses question_recent. */
export const SELECT_RECENT_QUESTIONS = `
  SELECT q.id, q.body, q.status, q.topic_id, t.label AS topic_label, q.created_at
  FROM question AS q
  LEFT JOIN topic AS t ON t.id = q.topic_id
  ORDER BY q.created_at DESC
  LIMIT ?`

// ---------- topics ----------

export const SELECT_TOPIC_CENTROIDS = `SELECT id, centroid, question_count FROM topic`

export const COUNT_TOPICS = `SELECT COUNT(*) AS count FROM topic`

export const SELECT_TOPIC = `
  SELECT id, label, label_source, labeled_at_size, centroid, question_count, member_count, resolved_at
  FROM topic
  WHERE id = ?`

export const INSERT_TOPIC = `
  INSERT INTO topic (label, label_source, labeled_at_size, centroid, question_count, created_at, updated_at)
  VALUES (?, 'question', 1, ?, 1, ?, ?)
  RETURNING id`

/** A new question joined: move the centroid, bump the count, and reopen the topic if it was resolved. */
export const ADD_QUESTION_TO_TOPIC = `
  UPDATE topic
  SET centroid = ?, question_count = question_count + 1, resolved_at = NULL, updated_at = ?
  WHERE id = ?`

export const REMOVE_QUESTION_FROM_TOPIC = `
  UPDATE topic
  SET centroid = ?, question_count = question_count - 1, updated_at = ?
  WHERE id = ?`

export const UPDATE_TOPIC_LABEL = `
  UPDATE topic
  SET label = ?, label_source = ?, labeled_at_size = ?, updated_at = ?
  WHERE id = ?`

export const RESOLVE_TOPIC = `
  UPDATE topic
  SET resolved_at = ?, understood_count = 0, still_confused_count = 0, updated_at = ?
  WHERE id = ? AND resolved_at IS NULL`

export const CLEAR_TOPIC_FEEDBACK = `UPDATE topic_member SET feedback = NULL WHERE topic_id = ?`

export const DELETE_TOPIC = `DELETE FROM topic WHERE id = ?`

export const DELETE_TOPIC_MEMBERS = `DELETE FROM topic_member WHERE topic_id = ?`

/** Snapshot: topics ordered for display, open ones first, then by how many people are confused. */
export const SELECT_SNAPSHOT_TOPICS = `
  SELECT id, label, member_count, resolved_at, understood_count, still_confused_count
  FROM topic
  WHERE question_count > 0
  ORDER BY (resolved_at IS NOT NULL), member_count DESC, updated_at DESC
  LIMIT ?`

// ---------- members ----------

/**
 * Callers check SELECT_MEMBER first so they know whether to bump member_count;
 * DO NOTHING is only a safety net so a duplicate can never be counted twice.
 */
export const INSERT_MEMBER = `
  INSERT INTO topic_member (topic_id, device_hash, via, created_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT (topic_id, device_hash) DO NOTHING`

export const SELECT_MEMBER = `
  SELECT via, feedback
  FROM topic_member
  WHERE topic_id = ? AND device_hash = ?`

/** Someone who tapped "ฉันก็งง" and later asked in their own words now counts as an asker. */
export const MARK_MEMBER_AS_ASKER = `
  UPDATE topic_member
  SET via = 'ask'
  WHERE topic_id = ? AND device_hash = ?`

export const DELETE_MEMBER = `DELETE FROM topic_member WHERE topic_id = ? AND device_hash = ?`

export const CHANGE_MEMBER_COUNT = `
  UPDATE topic
  SET member_count = member_count + ?, updated_at = ?
  WHERE id = ?`

export const UPDATE_MEMBER_FEEDBACK = `
  UPDATE topic_member
  SET feedback = ?
  WHERE topic_id = ? AND device_hash = ?`

export const CHANGE_FEEDBACK_COUNTS = `
  UPDATE topic
  SET understood_count = understood_count + ?, still_confused_count = still_confused_count + ?
  WHERE id = ?`

/** A student's own topics, to restore button states after a reload. Uses member_by_device. */
export const SELECT_MEMBERSHIPS_BY_DEVICE = `
  SELECT topic_id, via, feedback
  FROM topic_member
  WHERE device_hash = ?`

/** Confusion meter: distinct people confused about an open topic recently. Uses member_recent. */
export const COUNT_CONFUSED_RECENT = `
  SELECT COUNT(DISTINCT m.device_hash) AS count
  FROM topic_member AS m
  JOIN topic AS t ON t.id = m.topic_id
  WHERE t.resolved_at IS NULL AND m.created_at >= ?`
