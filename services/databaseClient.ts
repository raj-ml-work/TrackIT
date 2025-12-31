/**
 * Unified Database Client
 *
 * This file provides a unified interface for database operations that can switch between
 * Supabase, PostgreSQL, and SQLite based on configuration.
 */

import { dbConfig, DatabaseType } from './database';

// Type definitions for query operations
export interface QueryResult<T = any> {
  data: T[] | null;
  error: Error | null;
  count?: number;
}

export interface SingleQueryResult<T = any> {
  data: T | null;
  error: Error | null;
}

export interface MutationResult {
  data: any;
  error: Error | null;
}

// Query builder interface (simplified Supabase-like API)
export interface QueryBuilder {
  select(columns?: string): QueryBuilder;
  eq(column: string, value: any): QueryBuilder;
  neq(column: string, value: any): QueryBuilder;
  gt(column: string, value: any): QueryBuilder;
  gte(column: string, value: any): QueryBuilder;
  lt(column: string, value: any): QueryBuilder;
  lte(column: string, value: any): QueryBuilder;
  like(column: string, pattern: string): QueryBuilder;
  ilike(column: string, pattern: string): QueryBuilder;
  in(column: string, values: any[]): QueryBuilder;
  is(column: string, value: any): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  limit(count: number): QueryBuilder;
  range(from: number, to: number): QueryBuilder;
  single(): Promise<SingleQueryResult>;
  maybeSingle(): Promise<SingleQueryResult>;
  then(onfulfilled?: (value: QueryResult) => any, onrejected?: (reason: any) => any): Promise<any>;
}

export interface InsertBuilder {
  select(columns?: string): InsertBuilder;
  single(): Promise<SingleQueryResult>;
  execute(): Promise<MutationResult>;
  then(onfulfilled?: (value: MutationResult) => any, onrejected?: (reason: any) => any): Promise<any>;
}

export interface UpdateBuilder {
  select(columns?: string): UpdateBuilder;
  eq(column: string, value: any): UpdateBuilder;
  single(): Promise<SingleQueryResult>;
  execute(): Promise<MutationResult>;
  then(onfulfilled?: (value: MutationResult) => any, onrejected?: (reason: any) => any): Promise<any>;
}

export interface DeleteBuilder {
  eq(column: string, value: any): DeleteBuilder;
  execute(): Promise<MutationResult>;
  then(onfulfilled?: (value: MutationResult) => any, onrejected?: (reason: any) => any): Promise<any>;
}

export interface DatabaseClient {
  from(table: string): TableClient;
  rpc(functionName: string, params?: any): Promise<QueryResult>;
}

export interface TableClient {
  select(columns?: string): QueryBuilder;
  insert(data: any | any[]): InsertBuilder;
  update(data: any): UpdateBuilder;
  delete(): DeleteBuilder;
  upsert(data: any, options?: { onConflict?: string }): InsertBuilder;
}

// Import clients
let supabaseClient: any = null;
let sqliteClient: any = null;

/**
 * Get the appropriate database client based on configuration
 */
export const getDatabaseClient = async (): Promise<DatabaseClient> => {
  if (dbConfig.type === DatabaseType.SUPABASE) {
    if (!supabaseClient) {
      const { getSupabaseClient } = await import('./supabaseClient');
      supabaseClient = await getSupabaseClient();
    }
    return createSupabaseAdapter(supabaseClient);
  }

  if (dbConfig.type === DatabaseType.SQLITE) {
    if (!sqliteClient) {
      const { getSQLiteClient } = await import('./sqliteClient');
      sqliteClient = getSQLiteClient();
    }
    return createSQLiteAdapter(sqliteClient);
  }

  // For PostgreSQL, we'll implement later
  throw new Error(`Database type ${dbConfig.type} not yet implemented`);
};

/**
 * Create Supabase adapter (passes through to Supabase client)
 */
const createSupabaseAdapter = (client: any): DatabaseClient => {
  return {
    from: (table: string) => client.from(table),
    rpc: (functionName: string, params?: any) => client.rpc(functionName, params)
  };
};

/**
 * Create SQLite adapter (converts Supabase-style queries to SQLite)
 */
const createSQLiteAdapter = (client: any): DatabaseClient => {
  return {
    from: (table: string) => new SQLiteTableClient(client, table),
    rpc: () => {
      throw new Error('RPC functions not supported in SQLite adapter');
    }
  };
};

/**
 * SQLite Table Client - implements Supabase-like query interface for SQLite
 */
class SQLiteTableClient implements TableClient {
  constructor(private client: any, private table: string) {}

  select(columns: string = '*'): QueryBuilder {
    return new SQLiteQueryBuilder(this.client, this.table, columns);
  }

  insert(data: any | any[]): InsertBuilder {
    return new SQLiteInsertBuilder(this.client, this.table, data);
  }

  update(data: any): UpdateBuilder {
    return new SQLiteUpdateBuilder(this.client, this.table, data);
  }

  delete(): DeleteBuilder {
    return new SQLiteDeleteBuilder(this.client, this.table);
  }

  upsert(data: any, options?: { onConflict?: string }): InsertBuilder {
    // For simplicity, treat upsert as insert for now
    return new SQLiteInsertBuilder(this.client, this.table, data, true);
  }
}

/**
 * SQLite Query Builder
 */
class SQLiteQueryBuilder implements QueryBuilder {
  private conditions: string[] = [];
  private params: any[] = [];
  private orderBy: string = '';
  private limitCount: number = -1;
  private offsetCount: number = 0;

  constructor(
    private client: any,
    private table: string,
    private columns: string = '*'
  ) {}

  select(columns: string): QueryBuilder {
    this.columns = columns;
    return this;
  }

  eq(column: string, value: any): QueryBuilder {
    this.conditions.push(`${column} = ?`);
    this.params.push(value);
    return this;
  }

  neq(column: string, value: any): QueryBuilder {
    this.conditions.push(`${column} != ?`);
    this.params.push(value);
    return this;
  }

  gt(column: string, value: any): QueryBuilder {
    this.conditions.push(`${column} > ?`);
    this.params.push(value);
    return this;
  }

  gte(column: string, value: any): QueryBuilder {
    this.conditions.push(`${column} >= ?`);
    this.params.push(value);
    return this;
  }

  lt(column: string, value: any): QueryBuilder {
    this.conditions.push(`${column} < ?`);
    this.params.push(value);
    return this;
  }

  lte(column: string, value: any): QueryBuilder {
    this.conditions.push(`${column} <= ?`);
    this.params.push(value);
    return this;
  }

  like(column: string, pattern: string): QueryBuilder {
    this.conditions.push(`${column} LIKE ?`);
    this.params.push(pattern);
    return this;
  }

  ilike(column: string, pattern: string): QueryBuilder {
    // SQLite doesn't have ILIKE, use LOWER
    this.conditions.push(`LOWER(${column}) LIKE LOWER(?)`);
    this.params.push(pattern);
    return this;
  }

  in(column: string, values: any[]): QueryBuilder {
    const placeholders = values.map(() => '?').join(',');
    this.conditions.push(`${column} IN (${placeholders})`);
    this.params.push(...values);
    return this;
  }

  is(column: string, value: any): QueryBuilder {
    if (value === null) {
      this.conditions.push(`${column} IS NULL`);
    } else {
      this.conditions.push(`${column} IS ?`);
      this.params.push(value);
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder {
    const direction = options?.ascending === false ? 'DESC' : 'ASC';
    this.orderBy = `ORDER BY ${column} ${direction}`;
    return this;
  }

  limit(count: number): QueryBuilder {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number): QueryBuilder {
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  async single(): Promise<SingleQueryResult> {
    try {
      const sql = this.buildSQL();
      const result = this.client.prepare(sql).get(...this.params);
      return { data: result || null, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async maybeSingle(): Promise<SingleQueryResult> {
    return this.single();
  }

  async execute(): Promise<QueryResult> {
    try {
      const sql = this.buildSQL();
      const results = this.client.prepare(sql).all(...this.params);
      return { data: results, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  then(onfulfilled?: (value: QueryResult) => any, onrejected?: (reason: any) => any): Promise<any> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private buildSQL(): string {
    let sql = `SELECT ${this.columns} FROM ${this.table}`;

    if (this.conditions.length > 0) {
      sql += ` WHERE ${this.conditions.join(' AND ')}`;
    }

    if (this.orderBy) {
      sql += ` ${this.orderBy}`;
    }

    if (this.limitCount > 0) {
      sql += ` LIMIT ${this.limitCount}`;
    }

    if (this.offsetCount > 0) {
      sql += ` OFFSET ${this.offsetCount}`;
    }

    return sql;
  }
}

/**
 * SQLite Insert Builder
 */
class SQLiteInsertBuilder implements InsertBuilder {
  constructor(
    private client: any,
    private table: string,
    private data: any | any[],
    private upsert: boolean = false
  ) {}

  select(): InsertBuilder {
    return this;
  }

  async single(): Promise<SingleQueryResult> {
    const result = await this.execute();
    if (result.error) {
      return { data: null, error: result.error };
    }
    const data = Array.isArray(result.data) ? result.data[0] : result.data;
    return { data, error: null };
  }

  async execute(): Promise<MutationResult> {
    try {
      const items = Array.isArray(this.data) ? this.data : [this.data];
      const results: any[] = [];

      for (const item of items) {
        const columns = Object.keys(item);
        const placeholders = columns.map(() => '?').join(',');
        const values = columns.map(col => item[col]);

        let sql = `INSERT INTO ${this.table} (${columns.join(',')}) VALUES (${placeholders})`;

        if (this.upsert) {
          // Simple upsert - replace on conflict
          sql += ' ON CONFLICT REPLACE';
        }

        const result = this.client.prepare(sql).run(...values);
        results.push(result);
      }

      return { data: results, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  then(onfulfilled?: (value: MutationResult) => any, onrejected?: (reason: any) => any): Promise<any> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * SQLite Update Builder
 */
class SQLiteUpdateBuilder implements UpdateBuilder {
  private conditions: string[] = [];
  private conditionParams: any[] = [];

  constructor(
    private client: any,
    private table: string,
    private data: any
  ) {}

  select(): UpdateBuilder {
    return this;
  }

  eq(column: string, value: any): UpdateBuilder {
    this.conditions.push(`${column} = ?`);
    this.conditionParams.push(value);
    return this;
  }

  async single(): Promise<SingleQueryResult> {
    const result = await this.execute();
    if (result.error) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  }

  async execute(): Promise<MutationResult> {
    try {
      const columns = Object.keys(this.data);
      const setClause = columns.map(col => `${col} = ?`).join(',');
      const values = columns.map(col => this.data[col]);

      let sql = `UPDATE ${this.table} SET ${setClause}`;

      if (this.conditions.length > 0) {
        sql += ` WHERE ${this.conditions.join(' AND ')}`;
      }

      const result = this.client.prepare(sql).run(...values, ...this.conditionParams);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  then(onfulfilled?: (value: MutationResult) => any, onrejected?: (reason: any) => any): Promise<any> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * SQLite Delete Builder
 */
class SQLiteDeleteBuilder implements DeleteBuilder {
  private conditions: string[] = [];
  private conditionParams: any[] = [];

  constructor(private client: any, private table: string) {}

  eq(column: string, value: any): DeleteBuilder {
    this.conditions.push(`${column} = ?`);
    this.conditionParams.push(value);
    return this;
  }

  async execute(): Promise<MutationResult> {
    try {
      let sql = `DELETE FROM ${this.table}`;

      if (this.conditions.length > 0) {
        sql += ` WHERE ${this.conditions.join(' AND ')}`;
      }

      const result = this.client.prepare(sql).run(...this.conditionParams);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  then(onfulfilled?: (value: MutationResult) => any, onrejected?: (reason: any) => any): Promise<any> {
    return this.execute().then(onfulfilled, onrejected);
  }
}