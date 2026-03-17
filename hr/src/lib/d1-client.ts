/**
 * Lightweight D1 SQL Client — Drop-in replacement for Prisma on Cloudflare Workers.
 *
 * Eliminates the 3.4MB Prisma WASM dependency, keeping the bundle under 3MB (free tier).
 * Implements the same API surface used across 74 API routes:
 *   findMany, findFirst, findUnique, create, createMany, update, updateMany,
 *   delete, deleteMany, count, upsert, groupBy, $transaction
 */

// ─── Model → Table name mapping (from Prisma @@map) ───

// Tables that are global (no tenant filtering in relation subqueries)
const GLOBAL_TABLES = new Set(['tenants', 'tenant_settings', 'super_admins', 'tenant_usage_logs']);

const MODEL_TABLE_MAP: Record<string, string> = {
  tenant: 'tenants',
  tenantSetting: 'tenant_settings',
  superAdmin: 'super_admins',
  tenantUsageLog: 'tenant_usage_logs',
  department: 'departments',
  position: 'positions',
  employee: 'employees',
  viewPermission: 'view_permissions',
  session: 'sessions',
  leaveType: 'leave_types',
  leavePolicy: 'leave_policies',
  leaveGrant: 'leave_grants',
  leaveBalance: 'leave_balances',
  leaveRequest: 'leave_requests',
  approvalLine: 'approval_lines',
  approvalStep: 'approval_steps',
  approval: 'approvals',
  overtimeRequest: 'overtime_requests',
  overtimePolicy: 'overtime_policies',
  externalIntegration: 'external_integrations',
  auditLog: 'audit_logs',
  systemConfig: 'system_configs',
  holiday: 'holidays',
  passwordReset: 'password_resets',
  notification: 'notifications',
  timeWallet: 'time_wallets',
  timeDeduction: 'time_deductions',
  compTimeAccrual: 'comp_time_accruals',
  compensationPolicy: 'compensation_policies',
  welfareCategory: 'welfare_categories',
  welfareItem: 'welfare_items',
  welfareRequest: 'welfare_requests',
  attendance: 'attendances',
};

// ─── Relation metadata (for include/select joins) ───

interface RelationMeta {
  foreignKey: string;
  targetTable: string;
  targetModel: string;
  type: 'belongsTo' | 'hasMany' | 'hasOne';
}

const RELATIONS: Record<string, Record<string, RelationMeta>> = {
  employee: {
    department: { foreignKey: 'departmentId', targetTable: 'departments', targetModel: 'department', type: 'belongsTo' },
    position: { foreignKey: 'positionId', targetTable: 'positions', targetModel: 'position', type: 'belongsTo' },
    leaveRequests: { foreignKey: 'employeeId', targetTable: 'leave_requests', targetModel: 'leaveRequest', type: 'hasMany' },
    leaveBalances: { foreignKey: 'employeeId', targetTable: 'leave_balances', targetModel: 'leaveBalance', type: 'hasMany' },
    leaveGrants: { foreignKey: 'employeeId', targetTable: 'leave_grants', targetModel: 'leaveGrant', type: 'hasMany' },
    approvalSteps: { foreignKey: 'approverId', targetTable: 'approval_steps', targetModel: 'approvalStep', type: 'hasMany' },
    approvals: { foreignKey: 'approverId', targetTable: 'approvals', targetModel: 'approval', type: 'hasMany' },
    overtimeRequests: { foreignKey: 'employeeId', targetTable: 'overtime_requests', targetModel: 'overtimeRequest', type: 'hasMany' },
    sessions: { foreignKey: 'employeeId', targetTable: 'sessions', targetModel: 'session', type: 'hasMany' },
    notifications: { foreignKey: 'employeeId', targetTable: 'notifications', targetModel: 'notification', type: 'hasMany' },
    timeWallets: { foreignKey: 'employeeId', targetTable: 'time_wallets', targetModel: 'timeWallet', type: 'hasMany' },
    timeDeductions: { foreignKey: 'employeeId', targetTable: 'time_deductions', targetModel: 'timeDeduction', type: 'hasMany' },
    compTimeAccruals: { foreignKey: 'employeeId', targetTable: 'comp_time_accruals', targetModel: 'compTimeAccrual', type: 'hasMany' },
    welfareRequests: { foreignKey: 'employeeId', targetTable: 'welfare_requests', targetModel: 'welfareRequest', type: 'hasMany' },
    attendances: { foreignKey: 'employeeId', targetTable: 'attendances', targetModel: 'attendance', type: 'hasMany' },
  },
  leaveRequest: {
    employee: { foreignKey: 'employeeId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
    leaveType: { foreignKey: 'leaveTypeId', targetTable: 'leave_types', targetModel: 'leaveType', type: 'belongsTo' },
    approvals: { foreignKey: 'leaveRequestId', targetTable: 'approvals', targetModel: 'approval', type: 'hasMany' },
  },
  leaveGrant: {
    employee: { foreignKey: 'employeeId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
  },
  leaveBalance: {
    employee: { foreignKey: 'employeeId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
  },
  leavePolicy: {
    leaveType: { foreignKey: 'leaveTypeId', targetTable: 'leave_types', targetModel: 'leaveType', type: 'belongsTo' },
  },
  leaveType: {
    leaveRequests: { foreignKey: 'leaveTypeId', targetTable: 'leave_requests', targetModel: 'leaveRequest', type: 'hasMany' },
    leavePolicies: { foreignKey: 'leaveTypeId', targetTable: 'leave_policies', targetModel: 'leavePolicy', type: 'hasMany' },
  },
  approval: {
    leaveRequest: { foreignKey: 'leaveRequestId', targetTable: 'leave_requests', targetModel: 'leaveRequest', type: 'belongsTo' },
    overtime: { foreignKey: 'overtimeId', targetTable: 'overtime_requests', targetModel: 'overtimeRequest', type: 'belongsTo' },
    approver: { foreignKey: 'approverId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
  },
  approvalStep: {
    approvalLine: { foreignKey: 'approvalLineId', targetTable: 'approval_lines', targetModel: 'approvalLine', type: 'belongsTo' },
    approver: { foreignKey: 'approverId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
  },
  approvalLine: {
    steps: { foreignKey: 'approvalLineId', targetTable: 'approval_steps', targetModel: 'approvalStep', type: 'hasMany' },
  },
  overtimeRequest: {
    employee: { foreignKey: 'employeeId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
    approvals: { foreignKey: 'overtimeId', targetTable: 'approvals', targetModel: 'approval', type: 'hasMany' },
  },
  session: {
    employee: { foreignKey: 'employeeId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
  },
  notification: {
    employee: { foreignKey: 'employeeId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
  },
  timeWallet: {
    employee: { foreignKey: 'employeeId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
  },
  timeDeduction: {
    employee: { foreignKey: 'employeeId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
  },
  compTimeAccrual: {
    employee: { foreignKey: 'employeeId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
  },
  welfareRequest: {
    employee: { foreignKey: 'employeeId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
    item: { foreignKey: 'itemId', targetTable: 'welfare_items', targetModel: 'welfareItem', type: 'belongsTo' },
  },
  welfareItem: {
    category: { foreignKey: 'categoryId', targetTable: 'welfare_categories', targetModel: 'welfareCategory', type: 'belongsTo' },
    requests: { foreignKey: 'itemId', targetTable: 'welfare_requests', targetModel: 'welfareRequest', type: 'hasMany' },
  },
  welfareCategory: {
    items: { foreignKey: 'categoryId', targetTable: 'welfare_items', targetModel: 'welfareItem', type: 'hasMany' },
  },
  attendance: {
    employee: { foreignKey: 'employeeId', targetTable: 'employees', targetModel: 'employee', type: 'belongsTo' },
  },
  department: {
    parent: { foreignKey: 'parentId', targetTable: 'departments', targetModel: 'department', type: 'belongsTo' },
    children: { foreignKey: 'parentId', targetTable: 'departments', targetModel: 'department', type: 'hasMany' },
    employees: { foreignKey: 'departmentId', targetTable: 'employees', targetModel: 'employee', type: 'hasMany' },
  },
  position: {
    employees: { foreignKey: 'positionId', targetTable: 'employees', targetModel: 'employee', type: 'hasMany' },
  },
};

// ─── Composite unique key mappings ───

const COMPOSITE_UNIQUE_KEYS: Record<string, Record<string, string[]>> = {
  departments: {
    tenantId_name: ['tenantId', 'name'],
    tenantId_code: ['tenantId', 'code'],
  },
  positions: {
    tenantId_name: ['tenantId', 'name'],
    tenantId_level: ['tenantId', 'level'],
  },
  employees: {
    tenantId_email: ['tenantId', 'email'],
    tenantId_employeeNumber: ['tenantId', 'employeeNumber'],
  },
  leave_types: {
    tenantId_name: ['tenantId', 'name'],
    tenantId_code: ['tenantId', 'code'],
  },
  leave_balances: {
    tenantId_employeeId_year_leaveTypeCode: ['tenantId', 'employeeId', 'year', 'leaveTypeCode'],
  },
  time_wallets: {
    tenantId_employeeId_year_type: ['tenantId', 'employeeId', 'year', 'type'],
  },
  system_configs: {
    tenantId_key: ['tenantId', 'key'],
  },
  tenant_settings: {
    tenantId_key: ['tenantId', 'key'],
  },
  tenant_usage_logs: {
    tenantId_date: ['tenantId', 'date'],
  },
  view_permissions: {
    tenantId_employeeId_scope: ['tenantId', 'employeeId', 'scope'],
  },
  approval_steps: {
    tenantId_approvalLineId_stepOrder: ['tenantId', 'approvalLineId', 'stepOrder'],
  },
  external_integrations: {
    tenantId_employeeId_service: ['tenantId', 'employeeId', 'service'],
  },
  welfare_categories: {
    tenantId_name: ['tenantId', 'name'],
  },
  attendances: {
    tenantId_employeeId_date: ['tenantId', 'employeeId', 'date'],
  },
};

// ─── SQL Builder utilities ───

function generateCuid(): string {
  const ts = Date.now().toString(36);
  const uuid = crypto.randomUUID().replace(/-/g, '');
  return `c${ts}${uuid.substring(0, 14)}`;
}

function toSqlValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

// Boolean field detection — exhaustive set instead of prefix heuristic
const BOOLEAN_FIELDS = new Set([
  'isActive', 'isPaid', 'isAnnualDeduct', 'requiresDoc', 'isDefault',
  'isRecurring', 'isExpired', 'isRead', 'requireApproval', 'autoSplitDeduct',
  'mustChangePassword',
]);

function fromSqlRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'number' && (value === 0 || value === 1)) {
      if (BOOLEAN_FIELDS.has(key)) {
        result[key] = value === 1;
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      result[key] = new Date(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Tables that do NOT have an updatedAt column
const NO_UPDATED_AT = new Set([
  'tenant_usage_logs', 'view_permissions', 'sessions', 'approval_steps',
  'approvals', 'audit_logs', 'password_resets', 'notifications',
  'time_deductions', 'comp_time_accruals',
]);

// Tables that do NOT have a createdAt column
const NO_CREATED_AT = new Set([
  'time_wallets', 'approval_steps',
]);

// ─── WHERE clause builder ───

interface WhereResult {
  sql: string;
  params: unknown[];
}

function buildWhere(where: Record<string, unknown> | undefined, params: unknown[] = [], contextModel?: string): WhereResult {
  if (!where || Object.keys(where).length === 0) {
    return { sql: '', params };
  }

  const conditions: string[] = [];

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;

    if (key === 'OR' && Array.isArray(value)) {
      const orConditions: string[] = [];
      for (const orItem of value) {
        const sub = buildWhere(orItem as Record<string, unknown>, params, contextModel);
        params = sub.params;
        if (sub.sql) orConditions.push(`(${sub.sql})`);
      }
      if (orConditions.length > 0) {
        conditions.push(`(${orConditions.join(' OR ')})`);
      }
      continue;
    }

    if (key === 'AND' && Array.isArray(value)) {
      const andConditions: string[] = [];
      for (const andItem of value) {
        const sub = buildWhere(andItem as Record<string, unknown>, params, contextModel);
        params = sub.params;
        if (sub.sql) andConditions.push(`(${sub.sql})`);
      }
      if (andConditions.length > 0) {
        conditions.push(`(${andConditions.join(' AND ')})`);
      }
      continue;
    }

    if (key === 'NOT') {
      const notValue = value as Record<string, unknown>;
      const sub = buildWhere(notValue, params, contextModel);
      params = sub.params;
      if (sub.sql) {
        conditions.push(`NOT (${sub.sql})`);
      }
      continue;
    }

    if (value === null) {
      conditions.push(`"${key}" IS NULL`);
      continue;
    }

    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      const ops = value as Record<string, unknown>;

      // Check if this key is a belongsTo relation (nested relation WHERE)
      if (contextModel) {
        const modelRelations = RELATIONS[contextModel];
        if (modelRelations && modelRelations[key] && modelRelations[key].type === 'belongsTo') {
          const relMeta = modelRelations[key];
          const nestedWhere = buildWhere(ops, params, relMeta.targetModel);
          params = nestedWhere.params;
          if (nestedWhere.sql) {
            conditions.push(`"${relMeta.foreignKey}" IN (SELECT "id" FROM "${relMeta.targetTable}" WHERE ${nestedWhere.sql})`);
          }
          continue;
        }
      }

      if ('equals' in ops) {
        params.push(toSqlValue(ops.equals));
        conditions.push(`"${key}" = ?`);
      }
      if ('not' in ops) {
        if (ops.not === null) {
          conditions.push(`"${key}" IS NOT NULL`);
        } else {
          params.push(toSqlValue(ops.not));
          conditions.push(`"${key}" != ?`);
        }
      }
      if ('in' in ops && Array.isArray(ops.in)) {
        if (ops.in.length === 0) {
          // Empty IN always matches nothing
          conditions.push('0=1');
        } else {
          const placeholders = ops.in.map(() => '?').join(', ');
          params.push(...ops.in.map(toSqlValue));
          conditions.push(`"${key}" IN (${placeholders})`);
        }
      }
      if ('notIn' in ops && Array.isArray(ops.notIn)) {
        if (ops.notIn.length === 0) {
          // Empty NOT IN always matches everything — no condition needed
        } else {
          const placeholders = ops.notIn.map(() => '?').join(', ');
          params.push(...ops.notIn.map(toSqlValue));
          conditions.push(`"${key}" NOT IN (${placeholders})`);
        }
      }
      if ('contains' in ops) {
        const mode = (ops as Record<string, unknown>).mode;
        if (mode === 'insensitive') {
          params.push(`%${ops.contains}%`);
          conditions.push(`"${key}" LIKE ? COLLATE NOCASE`);
        } else {
          params.push(`%${ops.contains}%`);
          conditions.push(`"${key}" LIKE ?`);
        }
      }
      if ('startsWith' in ops) {
        params.push(`${ops.startsWith}%`);
        conditions.push(`"${key}" LIKE ?`);
      }
      if ('endsWith' in ops) {
        params.push(`%${ops.endsWith}`);
        conditions.push(`"${key}" LIKE ?`);
      }
      if ('gte' in ops) {
        params.push(toSqlValue(ops.gte));
        conditions.push(`"${key}" >= ?`);
      }
      if ('gt' in ops) {
        params.push(toSqlValue(ops.gt));
        conditions.push(`"${key}" > ?`);
      }
      if ('lte' in ops) {
        params.push(toSqlValue(ops.lte));
        conditions.push(`"${key}" <= ?`);
      }
      if ('lt' in ops) {
        params.push(toSqlValue(ops.lt));
        conditions.push(`"${key}" < ?`);
      }
      continue;
    }

    // Simple equality
    params.push(toSqlValue(value));
    conditions.push(`"${key}" = ?`);
  }

  return {
    sql: conditions.length > 0 ? conditions.join(' AND ') : '',
    params,
  };
}

// ─── ORDER BY direction sanitizer ───

function sanitizeDirection(dir: string): string {
  const upper = dir.toUpperCase();
  if (upper !== 'ASC' && upper !== 'DESC') {
    throw new Error(`Invalid ORDER BY direction: ${dir}`);
  }
  return upper;
}

// ─── ORDER BY builder (supports nested relation ordering) ───

function buildOrderBy(orderBy: unknown, modelName?: string): string {
  if (!orderBy) return '';

  const outerTable = modelName ? MODEL_TABLE_MAP[modelName] : undefined;

  if (Array.isArray(orderBy)) {
    const parts = orderBy.map((item: Record<string, unknown>) => {
      const [field, dir] = Object.entries(item)[0];
      // Nested relation ordering: { position: { level: 'desc' } }
      if (typeof dir === 'object' && dir !== null && modelName) {
        const relMeta = RELATIONS[modelName]?.[field];
        if (relMeta && relMeta.type === 'belongsTo') {
          const [nestedField, nestedDir] = Object.entries(dir as Record<string, string>)[0];
          const fkRef = outerTable ? `"${outerTable}"."${relMeta.foreignKey}"` : `"${relMeta.foreignKey}"`;
          return `(SELECT "${nestedField}" FROM "${relMeta.targetTable}" WHERE "id" = ${fkRef}) ${sanitizeDirection(nestedDir)}`;
        }
      }
      return `"${field}" ${sanitizeDirection(dir as string)}`;
    });
    return ` ORDER BY ${parts.join(', ')}`;
  }

  if (typeof orderBy === 'object') {
    const entries = Object.entries(orderBy as Record<string, unknown>);
    if (entries.length > 0) {
      const parts = entries.map(([field, dir]) => {
        // Nested relation ordering: { position: { level: 'desc' } }
        if (typeof dir === 'object' && dir !== null && modelName) {
          const relMeta = RELATIONS[modelName]?.[field];
          if (relMeta && relMeta.type === 'belongsTo') {
            const [nestedField, nestedDir] = Object.entries(dir as Record<string, string>)[0];
            const fkRef = outerTable ? `"${outerTable}"."${relMeta.foreignKey}"` : `"${relMeta.foreignKey}"`;
            return `(SELECT "${nestedField}" FROM "${relMeta.targetTable}" WHERE "id" = ${fkRef}) ${sanitizeDirection(nestedDir)}`;
          }
        }
        return `"${field}" ${sanitizeDirection(dir as string)}`;
      });
      return ` ORDER BY ${parts.join(', ')}`;
    }
  }

  return '';
}

// ─── SELECT builder ───

function buildSelectColumns(select: Record<string, unknown> | undefined): string {
  if (!select) return '*';
  const cols = Object.entries(select)
    .filter(([, v]) => v === true)
    .map(([k]) => `"${k}"`);
  return cols.length > 0 ? cols.join(', ') : '*';
}

/**
 * Extract nested relation objects from a Prisma-style `select` clause.
 * In Prisma, `select: { department: { select: { id, name } } }` means
 * "include the department relation with only id and name selected".
 * Returns: { scalarSelect, relationIncludes } where scalarSelect has only
 * boolean entries, and relationIncludes maps relation names to their config.
 * Also ensures FK columns needed for relation resolution are included.
 */
function extractRelationSelects(
  modelName: string,
  select: Record<string, unknown> | undefined,
): { scalarSelect: Record<string, unknown> | undefined; relationIncludes: Record<string, unknown> | undefined } {
  if (!select) return { scalarSelect: undefined, relationIncludes: undefined };

  const relations = RELATIONS[modelName] || {};
  const scalarSelect: Record<string, unknown> = {};
  let relationIncludes: Record<string, unknown> | undefined;

  for (const [key, value] of Object.entries(select)) {
    if (value === true || value === false) {
      scalarSelect[key] = value;
    } else if (typeof value === 'object' && value !== null && relations[key]) {
      // This is a nested relation select (e.g., department: { select: { id: true, name: true } })
      if (!relationIncludes) relationIncludes = {};
      relationIncludes[key] = value;
      // Ensure the FK column is included in the scalar select
      const relMeta = relations[key];
      if (relMeta.type === 'belongsTo') {
        scalarSelect[relMeta.foreignKey] = true;
      }
    }
  }

  // Always include id for relation resolution
  scalarSelect.id = true;

  return { scalarSelect, relationIncludes };
}

// ─── UPDATE SET builder with increment/decrement support ───

interface SetResult {
  sql: string;
  params: unknown[];
}

function buildSetClause(data: Record<string, unknown>): SetResult {
  const parts: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      const ops = value as Record<string, unknown>;
      if ('set' in ops) {
        parts.push(`"${key}" = ?`);
        params.push(toSqlValue(ops.set));
        continue;
      }
      if ('increment' in ops) {
        parts.push(`"${key}" = "${key}" + ?`);
        params.push(ops.increment);
        continue;
      }
      if ('decrement' in ops) {
        parts.push(`"${key}" = "${key}" - ?`);
        params.push(ops.decrement);
        continue;
      }
    }

    parts.push(`"${key}" = ?`);
    params.push(toSqlValue(value));
  }

  return { sql: parts.join(', '), params };
}

// ─── Relation resolver (include/select) ───

async function resolveRelations(
  db: D1Database,
  modelName: string,
  rows: Record<string, unknown>[],
  include: Record<string, unknown> | undefined,
  tenantId?: string,
): Promise<Record<string, unknown>[]> {
  if (!include || rows.length === 0) return rows;

  const relations = RELATIONS[modelName] || {};

  for (const [relName, relConfig] of Object.entries(include)) {
    if (!relConfig) continue;

    // Handle _count includes: { _count: { select: { employees: true } } }
    // Batched: collect all parent IDs and query counts per relation in one query using GROUP BY
    if (relName === '_count') {
      const countConfig = relConfig as Record<string, unknown>;
      const countSelect = countConfig.select as Record<string, boolean> | undefined;
      if (!countSelect) continue;

      const parentIds = rows.map(r => r.id as string).filter(Boolean);

      // Initialize _count for all rows
      for (const row of rows) {
        (row as Record<string, unknown>)._count = {};
      }

      for (const [countRel, enabled] of Object.entries(countSelect)) {
        if (!enabled) continue;
        const countRelMeta = relations[countRel];
        if (!countRelMeta || countRelMeta.type !== 'hasMany') {
          for (const row of rows) {
            ((row as Record<string, unknown>)._count as Record<string, number>)[countRel] = 0;
          }
          continue;
        }

        // Batch count query: use IN clause with GROUP BY to get all counts at once
        // Split into chunks of 100 to avoid overly large IN clauses
        const CHUNK_SIZE = 100;
        const countMap = new Map<string, number>();

        for (let i = 0; i < parentIds.length; i += CHUNK_SIZE) {
          const chunk = parentIds.slice(i, i + CHUNK_SIZE);
          const placeholders = chunk.map(() => '?').join(', ');
          let countSql = `SELECT "${countRelMeta.foreignKey}" as fk, COUNT(*) as cnt FROM "${countRelMeta.targetTable}" WHERE "${countRelMeta.foreignKey}" IN (${placeholders})`;
          const countParams: unknown[] = [...chunk];
          if (tenantId && !GLOBAL_TABLES.has(countRelMeta.targetTable)) {
            countSql += ` AND "tenantId" = ?`;
            countParams.push(tenantId);
          }
          countSql += ` GROUP BY "${countRelMeta.foreignKey}"`;

          const countResult = await db.prepare(countSql).bind(...countParams).all();
          for (const r of (countResult.results || []) as Record<string, unknown>[]) {
            countMap.set(r.fk as string, r.cnt as number);
          }
        }

        // Map counts back to rows
        for (const row of rows) {
          ((row as Record<string, unknown>)._count as Record<string, number>)[countRel] = countMap.get(row.id as string) || 0;
        }
      }
      continue;
    }

    const relMeta = relations[relName];
    if (!relMeta) continue;

    let nestedInclude = typeof relConfig === 'object' && relConfig !== null
      ? (relConfig as Record<string, unknown>).include as Record<string, unknown> | undefined
      : undefined;
    const rawNestedSelect = typeof relConfig === 'object' && relConfig !== null
      ? (relConfig as Record<string, unknown>).select as Record<string, unknown> | undefined
      : undefined;
    // Nested include where filter
    const nestedWhere = typeof relConfig === 'object' && relConfig !== null
      ? (relConfig as Record<string, unknown>).where as Record<string, unknown> | undefined
      : undefined;
    // Nested include orderBy
    const nestedOrderBy = typeof relConfig === 'object' && relConfig !== null
      ? (relConfig as Record<string, unknown>).orderBy as unknown | undefined
      : undefined;

    // Extract relation selects from nestedSelect (e.g., department: { select: { id, name } })
    // so they are resolved as nested includes instead of being silently dropped
    let nestedSelect: Record<string, unknown> | undefined = rawNestedSelect;
    if (rawNestedSelect) {
      const { scalarSelect, relationIncludes } = extractRelationSelects(relMeta.targetModel, rawNestedSelect);
      nestedSelect = scalarSelect;
      if (relationIncludes) {
        nestedInclude = nestedInclude ? { ...nestedInclude, ...relationIncludes } : relationIncludes;
      }
    }

    if (relMeta.type === 'belongsTo') {
      const fkValues = Array.from(new Set(rows.map(r => r[relMeta.foreignKey]).filter(Boolean)));
      if (fkValues.length === 0) {
        for (const row of rows) {
          (row as Record<string, unknown>)[relName] = null;
        }
        continue;
      }

      const placeholders = fkValues.map(() => '?').join(', ');
      const cols = nestedSelect ? buildSelectColumns({ id: true, ...nestedSelect }) : '*';
      let sql = `SELECT ${cols} FROM "${relMeta.targetTable}" WHERE "id" IN (${placeholders})`;
      const bindParams: unknown[] = [...fkValues];

      if (nestedWhere) {
        const nwParams: unknown[] = [];
        const nw = buildWhere(nestedWhere, nwParams);
        if (nw.sql) {
          sql = `SELECT ${cols} FROM "${relMeta.targetTable}" WHERE "id" IN (${placeholders}) AND ${nw.sql}`;
          bindParams.push(...nwParams);
        }
      }

      // Tenant scoping for relation subqueries
      if (tenantId && !GLOBAL_TABLES.has(relMeta.targetTable)) {
        sql += ` AND "tenantId" = ?`;
        bindParams.push(tenantId);
      }

      const stmt = db.prepare(sql);
      const result = await stmt.bind(...bindParams).all();
      let relatedRows = (result.results || []).map(r => fromSqlRow(r as Record<string, unknown>));

      // Resolve nested includes (including relation selects extracted above)
      if (nestedInclude) {
        relatedRows = await resolveRelations(db, relMeta.targetModel, relatedRows, nestedInclude, tenantId);
      }

      const relMap = new Map(relatedRows.map(r => [r.id as string, r]));
      for (const row of rows) {
        (row as Record<string, unknown>)[relName] = relMap.get(row[relMeta.foreignKey] as string) || null;
      }
    } else if (relMeta.type === 'hasMany') {
      const parentIds = rows.map(r => r.id as string).filter(Boolean);
      if (parentIds.length === 0) continue;

      const placeholders = parentIds.map(() => '?').join(', ');
      // Ensure FK column is always included for proper grouping
      const cols = nestedSelect ? buildSelectColumns({ [relMeta.foreignKey]: true, id: true, ...nestedSelect }) : '*';
      const bindParams: unknown[] = [...parentIds];
      let sql = `SELECT ${cols} FROM "${relMeta.targetTable}" WHERE "${relMeta.foreignKey}" IN (${placeholders})`;

      // Tenant scoping for relation subqueries
      if (tenantId && !GLOBAL_TABLES.has(relMeta.targetTable)) {
        sql += ` AND "tenantId" = ?`;
        bindParams.push(tenantId);
      }

      // Apply nested where filter to hasMany children
      if (nestedWhere) {
        const nw = buildWhere(nestedWhere, bindParams);
        if (nw.sql) {
          sql += ` AND ${nw.sql}`;
        }
      }

      // Apply nested orderBy to hasMany children
      if (nestedOrderBy) {
        sql += buildOrderBy(nestedOrderBy, relMeta.targetModel);
      }

      const stmt = db.prepare(sql);
      const result = await stmt.bind(...bindParams).all();
      let relatedRows = (result.results || []).map(r => fromSqlRow(r as Record<string, unknown>));

      // Resolve nested includes (including relation selects extracted above)
      if (nestedInclude) {
        relatedRows = await resolveRelations(db, relMeta.targetModel, relatedRows, nestedInclude, tenantId);
      }

      const grouped = new Map<string, Record<string, unknown>[]>();
      for (const r of relatedRows) {
        const fk = r[relMeta.foreignKey] as string;
        if (!grouped.has(fk)) grouped.set(fk, []);
        grouped.get(fk)!.push(r);
      }
      for (const row of rows) {
        (row as Record<string, unknown>)[relName] = grouped.get(row.id as string) || [];
      }
    }
  }

  return rows;
}

// ─── Resolve composite unique key for where clause ───

function resolveCompositeWhere(table: string, where: Record<string, unknown>): Record<string, unknown> {
  const composites = COMPOSITE_UNIQUE_KEYS[table];
  if (!composites) return where;

  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(where)) {
    if (composites[key] && typeof value === 'object' && value !== null) {
      // Expand composite key: { tenantId_email: { tenantId: 'x', email: 'y' } }
      Object.assign(resolved, value);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

// ─── D1 Model delegate (implements Prisma model methods) ───

function createModelDelegate(db: D1Database, modelName: string) {
  const table = MODEL_TABLE_MAP[modelName];
  if (!table) throw new Error(`Unknown model: ${modelName}`);

  return {
    async findMany(args?: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    }) {
      const { where, orderBy, skip, take, include, select } = args || {};

      // Extract nested relation objects from select (Prisma select-with-relations pattern)
      const { scalarSelect, relationIncludes } = extractRelationSelects(modelName, select);
      const mergedInclude = include || relationIncludes
        ? { ...include, ...relationIncludes }
        : undefined;

      const cols = select ? buildSelectColumns(scalarSelect) : '*';
      const whereResult = buildWhere(where, [], modelName);
      let sql = `SELECT ${cols} FROM "${table}"`;
      if (whereResult.sql) sql += ` WHERE ${whereResult.sql}`;
      sql += buildOrderBy(orderBy, modelName);
      if (take !== undefined) {
        sql += ` LIMIT ${take}`;
        if (skip !== undefined) sql += ` OFFSET ${skip}`;
      }

      const stmt = db.prepare(sql);
      const result = await (whereResult.params.length > 0
        ? stmt.bind(...whereResult.params)
        : stmt
      ).all();

      let rows = (result.results || []).map(r => fromSqlRow(r as Record<string, unknown>));
      const tenantId = where?.tenantId as string | undefined;
      rows = await resolveRelations(db, modelName, rows, mergedInclude, tenantId);
      return rows;
    },

    async findFirst(args?: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    }) {
      const results = await this.findMany({ ...args, take: 1 });
      return results[0] || null;
    },

    async findUnique(args: {
      where: Record<string, unknown>;
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    }) {
      const resolvedWhere = resolveCompositeWhere(table, args.where);
      return this.findFirst({ ...args, where: resolvedWhere });
    },

    async create(args: {
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    }) {
      const data = { ...args.data };

      // Extract nested creates before inserting parent
      const nestedCreates: { relName: string; relMeta: RelationMeta; items: Record<string, unknown>[] }[] = [];
      const modelRelations = RELATIONS[modelName] || {};
      for (const [key, val] of Object.entries(data)) {
        if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
          const asObj = val as Record<string, unknown>;
          if ('create' in asObj && modelRelations[key] && modelRelations[key].type === 'hasMany') {
            const items = Array.isArray(asObj.create) ? asObj.create : [asObj.create];
            nestedCreates.push({ relName: key, relMeta: modelRelations[key], items: items as Record<string, unknown>[] });
            delete data[key];
          }
        }
      }

      // Auto-generate ID if not provided
      if (!data.id) data.id = generateCuid();

      // Auto-set timestamps
      const now = new Date().toISOString();
      if (!NO_CREATED_AT.has(table) && !data.createdAt) data.createdAt = now;
      if (!NO_UPDATED_AT.has(table) && !data.updatedAt) data.updatedAt = now;

      const columns = Object.keys(data).filter(k => data[k] !== undefined);
      const values = columns.map(k => toSqlValue(data[k]));
      const placeholders = columns.map(() => '?').join(', ');
      const colNames = columns.map(c => `"${c}"`).join(', ');

      const sql = `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders})`;
      await db.prepare(sql).bind(...values).run();

      // Process nested creates: insert children with parent's ID as FK
      for (const nc of nestedCreates) {
        const childTable = nc.relMeta.targetTable;
        for (const item of nc.items) {
          const childData = { ...item, [nc.relMeta.foreignKey]: data.id };
          if (!childData.id) childData.id = generateCuid();
          const childNow = new Date().toISOString();
          if (!NO_CREATED_AT.has(childTable) && !childData.createdAt) childData.createdAt = childNow;
          if (!NO_UPDATED_AT.has(childTable) && !childData.updatedAt) childData.updatedAt = childNow;

          const childCols = Object.keys(childData).filter(k => childData[k] !== undefined);
          const childVals = childCols.map(k => toSqlValue(childData[k]));
          const childPh = childCols.map(() => '?').join(', ');
          const childColNames = childCols.map(c => `"${c}"`).join(', ');
          const childSql = `INSERT INTO "${childTable}" (${childColNames}) VALUES (${childPh})`;
          await db.prepare(childSql).bind(...childVals).run();
        }
      }

      // Return created record
      const created = await this.findFirst({
        where: { id: data.id },
        include: args.include,
        select: args.select,
      });
      return created!;
    },

    async createMany(args: {
      data: Record<string, unknown>[];
      skipDuplicates?: boolean;
    }) {
      if (args.data.length === 0) return { count: 0 };

      // Build batch INSERT statements for performance
      try {
        const statements: D1PreparedStatement[] = [];
        const now = new Date().toISOString();

        for (const item of args.data) {
          const data = { ...item };
          if (!data.id) data.id = generateCuid();
          if (!NO_CREATED_AT.has(table) && !data.createdAt) data.createdAt = now;
          if (!NO_UPDATED_AT.has(table) && !data.updatedAt) data.updatedAt = now;

          const columns = Object.keys(data).filter(k => data[k] !== undefined);
          const values = columns.map(k => toSqlValue(data[k]));
          const placeholders = columns.map(() => '?').join(', ');
          const colNames = columns.map(c => `"${c}"`).join(', ');

          const verb = args.skipDuplicates ? 'INSERT OR IGNORE INTO' : 'INSERT INTO';
          const sql = `${verb} "${table}" (${colNames}) VALUES (${placeholders})`;
          statements.push(db.prepare(sql).bind(...values));
        }

        // D1 batch limit: execute in chunks of 50
        const BATCH_SIZE = 50;
        let count = 0;
        for (let i = 0; i < statements.length; i += BATCH_SIZE) {
          const chunk = statements.slice(i, i + BATCH_SIZE);
          const results = await db.batch(chunk);
          for (const r of results) {
            const changes = (r as D1Result<unknown>).meta?.changes ?? 0;
            count += changes;
          }
        }
        return { count };
      } catch (batchError) {
        // Fallback to sequential inserts if batch fails
        console.warn('[D1Client] createMany batch failed, falling back to sequential inserts:', batchError);
        let count = 0;
        for (const item of args.data) {
          try {
            await this.create({ data: item });
            count++;
          } catch (e: unknown) {
            if (args.skipDuplicates) {
              const msg = e instanceof Error ? e.message : String(e);
              if (msg.includes('UNIQUE constraint') || msg.includes('duplicate')) continue;
            }
            throw e;
          }
        }
        return { count };
      }
    },

    async update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    }) {
      const resolvedWhere = resolveCompositeWhere(table, args.where);
      const data = { ...args.data };

      // Auto-update timestamp
      if (!NO_UPDATED_AT.has(table) && !data.updatedAt) data.updatedAt = new Date().toISOString();

      const setResult = buildSetClause(data);
      if (!setResult.sql) {
        // Nothing to update — return existing record
        return this.findFirst({ where: resolvedWhere, include: args.include, select: args.select });
      }
      const whereResult = buildWhere(resolvedWhere, [], modelName);
      if (!whereResult.sql) {
        throw new Error(`Cannot update without WHERE clause on model ${modelName}`);
      }

      const sql = `UPDATE "${table}" SET ${setResult.sql} WHERE ${whereResult.sql}`;
      const allParams = [...setResult.params, ...whereResult.params];
      await db.prepare(sql).bind(...allParams).run();

      // Return updated record
      return this.findFirst({
        where: resolvedWhere,
        include: args.include,
        select: args.select,
      });
    },

    async updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) {
      const data = { ...args.data };
      if (!NO_UPDATED_AT.has(table) && !data.updatedAt) data.updatedAt = new Date().toISOString();

      const setResult = buildSetClause(data);
      if (!setResult.sql) {
        return { count: 0 };
      }
      const whereResult = buildWhere(args.where, [], modelName);

      let sql = `UPDATE "${table}" SET ${setResult.sql}`;
      if (whereResult.sql) sql += ` WHERE ${whereResult.sql}`;

      const allParams = [...setResult.params, ...whereResult.params];
      const result = await (allParams.length > 0
        ? db.prepare(sql).bind(...allParams)
        : db.prepare(sql)
      ).run();

      return { count: result.meta?.changes || 0 };
    },

    async delete(args: { where: Record<string, unknown> }) {
      const resolvedWhere = resolveCompositeWhere(table, args.where);

      // Get record before deleting
      const existing = await this.findFirst({ where: resolvedWhere });

      const whereResult = buildWhere(resolvedWhere, [], modelName);
      if (!whereResult.sql) {
        throw new Error(`Cannot delete without WHERE clause on model ${modelName}`);
      }
      const sql = `DELETE FROM "${table}" WHERE ${whereResult.sql}`;
      await (whereResult.params.length > 0
        ? db.prepare(sql).bind(...whereResult.params)
        : db.prepare(sql)
      ).run();

      return existing;
    },

    async deleteMany(args?: { where?: Record<string, unknown> }) {
      const whereResult = buildWhere(args?.where, [], modelName);
      let sql = `DELETE FROM "${table}"`;
      if (whereResult.sql) sql += ` WHERE ${whereResult.sql}`;

      const result = await (whereResult.params.length > 0
        ? db.prepare(sql).bind(...whereResult.params)
        : db.prepare(sql)
      ).run();

      return { count: result.meta?.changes || 0 };
    },

    async count(args?: { where?: Record<string, unknown> }) {
      const whereResult = buildWhere(args?.where, [], modelName);
      let sql = `SELECT COUNT(*) as count FROM "${table}"`;
      if (whereResult.sql) sql += ` WHERE ${whereResult.sql}`;

      const result = await (whereResult.params.length > 0
        ? db.prepare(sql).bind(...whereResult.params)
        : db.prepare(sql)
      ).first<{ count: number }>();

      return result?.count || 0;
    },

    async upsert(args: {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
      include?: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) {
      const resolvedWhere = resolveCompositeWhere(table, args.where);
      const existing = await this.findFirst({ where: resolvedWhere });

      if (existing) {
        return this.update({
          where: resolvedWhere,
          data: args.update,
          include: args.include,
          select: args.select,
        });
      } else {
        return this.create({
          data: args.create,
          include: args.include,
          select: args.select,
        });
      }
    },

    async groupBy(args: {
      by: string[];
      where?: Record<string, unknown>;
      _count?: Record<string, boolean>;
      _sum?: Record<string, boolean>;
      _avg?: Record<string, boolean>;
      _min?: Record<string, boolean>;
      _max?: Record<string, boolean>;
    }) {
      const { by, where, _count, _sum, _avg, _min, _max } = args;

      const selectParts = by.map(b => `"${b}"`);

      if (_count) {
        for (const [field, enabled] of Object.entries(_count)) {
          if (enabled) selectParts.push(`COUNT("${field}") as "_count_${field}"`);
        }
      }
      if (_sum) {
        for (const [field, enabled] of Object.entries(_sum)) {
          if (enabled) selectParts.push(`SUM("${field}") as "_sum_${field}"`);
        }
      }
      if (_avg) {
        for (const [field, enabled] of Object.entries(_avg)) {
          if (enabled) selectParts.push(`AVG("${field}") as "_avg_${field}"`);
        }
      }
      if (_min) {
        for (const [field, enabled] of Object.entries(_min)) {
          if (enabled) selectParts.push(`MIN("${field}") as "_min_${field}"`);
        }
      }
      if (_max) {
        for (const [field, enabled] of Object.entries(_max)) {
          if (enabled) selectParts.push(`MAX("${field}") as "_max_${field}"`);
        }
      }

      const whereResult = buildWhere(where, [], modelName);
      let sql = `SELECT ${selectParts.join(', ')} FROM "${table}"`;
      if (whereResult.sql) sql += ` WHERE ${whereResult.sql}`;
      sql += ` GROUP BY ${by.map(b => `"${b}"`).join(', ')}`;

      const result = await (whereResult.params.length > 0
        ? db.prepare(sql).bind(...whereResult.params)
        : db.prepare(sql)
      ).all();

      // Transform _count_field to _count: { field: value } format
      return (result.results || []).map((row: unknown) => {
        const r = row as Record<string, unknown>;
        const transformed: Record<string, unknown> = {};
        for (const b of by) transformed[b] = r[b];

        if (_count) {
          transformed._count = {};
          for (const field of Object.keys(_count)) {
            (transformed._count as Record<string, unknown>)[field] = r[`_count_${field}`];
          }
        }
        if (_sum) {
          transformed._sum = {};
          for (const field of Object.keys(_sum)) {
            (transformed._sum as Record<string, unknown>)[field] = r[`_sum_${field}`];
          }
        }
        if (_avg) {
          transformed._avg = {};
          for (const field of Object.keys(_avg)) {
            (transformed._avg as Record<string, unknown>)[field] = r[`_avg_${field}`];
          }
        }
        if (_min) {
          transformed._min = {};
          for (const field of Object.keys(_min)) {
            (transformed._min as Record<string, unknown>)[field] = r[`_min_${field}`];
          }
        }
        if (_max) {
          transformed._max = {};
          for (const field of Object.keys(_max)) {
            (transformed._max as Record<string, unknown>)[field] = r[`_max_${field}`];
          }
        }

        return transformed;
      });
    },
  };
}

// ─── D1 Client (Prisma-compatible interface) ───

type D1Database = {
  prepare(sql: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
};

type D1Result<T> = {
  results?: T[];
  success: boolean;
  meta?: { changes?: number; last_row_id?: number };
};

// ─── Tenant-scoped D1 Client wrapper ───

/**
 * Wraps a D1 client with automatic tenant filtering.
 * On each query, calls getTenantIdFn() to resolve the current tenantId
 * from request headers. Global models (Tenant, SuperAdmin, etc.) bypass filtering.
 */
export function withD1TenantScope(
  client: ReturnType<typeof createD1Client>,
  getTenantIdFn: () => Promise<string>,
) {
  const GLOBAL_MODELS = new Set([
    'tenant', 'tenantSetting', 'superAdmin', 'tenantUsageLog',
  ]);

  const proxy: any = new Proxy(client as any, {
    get(target: any, prop: string | symbol) {
      if (typeof prop === 'symbol' || prop === 'then') return undefined;

      // $transaction: pass tenant-scoped proxy to callback
      // NOTE: Same atomicity limitation as the base client — see createD1Client.$transaction
      if (prop === '$transaction') {
        return async (input: unknown) => {
          if (typeof input === 'function') return input(proxy);
          if (Array.isArray(input)) {
            const results: unknown[] = [];
            for (let i = 0; i < input.length; i++) {
              try {
                results.push(await input[i]);
              } catch (e) {
                console.warn(
                  `[D1Client] $transaction (tenant-scoped): promise at index ${i}/${input.length} failed. ` +
                  `${results.length} of ${input.length} operations succeeded before this error.`,
                  e instanceof Error ? e.message : e,
                );
                throw e;
              }
            }
            return results;
          }
          throw new Error('Invalid $transaction argument');
        };
      }

      // Other $ methods pass through
      if (typeof prop === 'string' && prop.startsWith('$')) {
        return target[prop];
      }

      const delegate = target[prop];
      if (!delegate || typeof delegate !== 'object') return delegate;

      // Global models: no tenant filtering
      if (GLOBAL_MODELS.has(prop as string)) return delegate;

      // Wrap each model method to inject tenantId
      return new Proxy(delegate, {
        get(dt: any, method: string | symbol) {
          if (typeof method === 'symbol') return undefined;
          const original = dt[method];
          if (typeof original !== 'function') return original;

          return async (...args: any[]) => {
            const tenantId = await getTenantIdFn();
            if (!tenantId) {
              // In SaaS mode, tenant ID must be present for non-global models
              const { isSaaSMode: checkSaaS } = await import('./deploy-config');
              if (checkSaaS()) {
                throw new Error(`Tenant context required in SaaS mode for model: ${prop as string}`);
              }
              return original.apply(dt, args);
            }

            const a = args[0] ? { ...args[0] } : {};
            switch (method) {
              case 'findMany':
              case 'findFirst':
              case 'count':
              case 'deleteMany':
              case 'updateMany':
              case 'groupBy':
                a.where = { ...a.where, tenantId };
                return original.call(dt, a);
              case 'findUnique': {
                // Resolve composite unique keys (e.g. tenantId_email → tenantId + email)
                // THEN force the scoped tenantId so composite keys cannot override it
                const table = MODEL_TABLE_MAP[prop as string];
                const resolved = table
                  ? resolveCompositeWhere(table, a.where || {})
                  : { ...a.where };
                resolved.tenantId = tenantId;
                // Call findFirst directly to avoid double resolveCompositeWhere
                const findFirst = dt.findFirst || dt['findFirst'];
                return findFirst.call(dt, { ...a, where: resolved });
              }
              case 'create':
                a.data = { ...a.data, tenantId };
                return original.call(dt, a);
              case 'createMany':
                a.data = (a.data || []).map((d: Record<string, unknown>) => ({ ...d, tenantId }));
                return original.call(dt, a);
              case 'update':
              case 'delete':
                a.where = { ...a.where, tenantId };
                return original.call(dt, a);
              case 'upsert':
                a.where = { ...a.where, tenantId };
                a.create = { ...a.create, tenantId };
                return original.call(dt, a);
              default:
                return original.apply(dt, args);
            }
          };
        },
      });
    },
  });

  return proxy;
}

// ─── D1 Client factory ───

export function createD1Client(db: D1Database) {
  const modelDelegates = new Map<string, ReturnType<typeof createModelDelegate>>();

  function getDelegate(modelName: string) {
    if (!modelDelegates.has(modelName)) {
      modelDelegates.set(modelName, createModelDelegate(db as D1Database, modelName));
    }
    return modelDelegates.get(modelName)!;
  }

  const client = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'then') return undefined;

      // $transaction support
      // NOTE: True atomicity is not possible with the array form because promises
      // are already executing when passed in. D1's db.batch() requires prepared
      // statements, not promises. The callback form provides logical grouping but
      // not D1-level atomicity. Achieving true atomicity would require architectural
      // changes (e.g., building SQL statements lazily and batching them).
      if (prop === '$transaction') {
        return async (input: unknown) => {
          if (typeof input === 'function') {
            return await input(client);
          }
          if (Array.isArray(input)) {
            const results: unknown[] = [];
            for (let i = 0; i < input.length; i++) {
              try {
                results.push(await input[i]);
              } catch (e) {
                console.warn(
                  `[D1Client] $transaction: promise at index ${i}/${input.length} failed. ` +
                  `${results.length} of ${input.length} operations succeeded before this error.`,
                  e instanceof Error ? e.message : e,
                );
                throw e;
              }
            }
            return results;
          }
          throw new Error('Invalid $transaction argument');
        };
      }

      // $executeRaw, $queryRaw
      if (prop === '$executeRaw' || prop === '$executeRawUnsafe') {
        return async (sql: string, ...params: unknown[]) => {
          await db.prepare(sql).bind(...params).run();
        };
      }
      if (prop === '$queryRaw' || prop === '$queryRawUnsafe') {
        return async (sql: string, ...params: unknown[]) => {
          const result = await db.prepare(sql).bind(...params).all();
          return result.results || [];
        };
      }

      // Model delegate
      if (MODEL_TABLE_MAP[prop]) {
        return getDelegate(prop);
      }

      return undefined;
    },
  });

  return client;
}
