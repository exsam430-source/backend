import pool from '../config/database.js';

const EventModel = {
  // Create
  async create(data) {
    const { userId = null, type, productId = null, meta = {}, ip = '', userAgent = '' } = data;

    const [result] = await pool.query(
      'INSERT INTO events (userId, type, productId, meta, ip, userAgent) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, type, productId, JSON.stringify(meta), ip, userAgent]
    );

    return { _id: result.insertId, ...data };
  },

  // Find
  async find(query = {}) {
    let sql = 'SELECT * FROM events WHERE 1=1';
    const params = [];

    if (query.type) {
      if (query.type.$in) {
        sql += ` AND type IN (${query.type.$in.map(() => '?').join(',')})`;
        params.push(...query.type.$in);
      } else {
        sql += ' AND type = ?';
        params.push(query.type);
      }
    }
    if (query.createdAt?.$gte) {
      sql += ' AND created_at >= ?';
      params.push(query.createdAt.$gte);
    }
    if (query.productId) {
      sql += ' AND productId = ?';
      params.push(query.productId);
    }
    if (query.$or) {
      const orConds = query.$or.map(cond => {
        if (cond.userId !== undefined) {
          params.push(cond.userId);
          return 'userId = ?';
        }
        if (cond.ip) {
          params.push(cond.ip);
          return 'ip = ?';
        }
        return '1=1';
      });
      sql += ` AND (${orConds.join(' OR ')})`;
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(sql, params);
    return rows.map(row => {
      row._id = row.id;
      row.meta = JSON.parse(row.meta || '{}');
      row.createdAt = row.created_at;
      return row;
    });
  },

  // Find one
  async findOne(query) {
    const results = await this.find(query);
    return results[0] || null;
  },

  // Aggregate
  async aggregate(pipeline) {
    // Handle specific aggregation patterns
    if (pipeline[0]?.$match && pipeline[1]?.$project && pipeline[2]?.$group) {
      // Unique visitors
      let sql = 'SELECT DISTINCT COALESCE(CAST(userId AS CHAR), ip) as visitor FROM events WHERE 1=1';
      const params = [];

      if (pipeline[0].$match.createdAt?.$gte) {
        sql += ' AND created_at >= ?';
        params.push(pipeline[0].$match.createdAt.$gte);
      }
      if (pipeline[0].$match.type?.$in) {
        sql += ` AND type IN (${pipeline[0].$match.type.$in.map(() => '?').join(',')})`;
        params.push(...pipeline[0].$match.type.$in);
      }
      if (pipeline[0].$match.type && !pipeline[0].$match.type.$in) {
        sql += ' AND type = ?';
        params.push(pipeline[0].$match.type);
      }

      const [rows] = await pool.query(sql, params);
      return rows.map(r => ({ _id: r.visitor }));
    }

    // Group by type
    if (pipeline[0]?.$group?._id === '$type') {
      const [rows] = await pool.query('SELECT type, COUNT(*) as count FROM events GROUP BY type');
      return rows.map(r => ({ _id: r.type, count: r.count }));
    }

    return [];
  },

  // Save
  async save() { return this; }
};

export default EventModel;