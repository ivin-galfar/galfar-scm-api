import pool from "../Config/db.js";
import { getLatestApprovalEntry } from "../helpers/SLAfunctions.js";

const sourceQueries = [
  [
    "receipts",
    `SELECT r.*,COALESCE(
          json_agg(
          json_build_object(
		      'role', a.role,
            'comments', a.comments,
            'date',a.timestamp,
            'status', a.status 
            )
            ) FILTER (WHERE a.id IS NOT NULL),
            '[]'
          ) AS approver_info  FROM receipts r LEFT JOIN approverdetails a on r.id = a.cs_id `,
    "plant_hireasset",
  ],
  ["log_statements", "SELECT * FROM log_statements", "logistics"],
  ["file_note", "SELECT * FROM file_note", "plant"],
  ["buy_rent_statements", "SELECT * FROM buy_rent_statements", "plant"],
];

const asArray = (value) => {
  if (value === undefined || value === null || value === "") return [];
  return (Array.isArray(value) ? value : String(value).split(","))
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
};

const getDepartment = (row) =>
  row.department_id ?? row.dept_id ?? row.department ?? row.dept ?? null;

const matchesDepartment = (row, departments) => {
  if (departments.length === 0) return true;
  const department = getDepartment(row.data);
  return (
    department !== null &&
    departments.includes(String(department).toLowerCase())
  );
};

const pendingForRole = (status, roles) => {
  const normalizedStatus = String(status ?? "")
    .toLowerCase()
    .trim();
  return roles.some((currentRole) => {
    if (
      ["inita", "initfn", "inith", "initpr", "initdc", "view"].includes(
        currentRole,
      )
    ) {
      return false;
    }
    if (currentRole === "fm") {
      return ["pending for fm", "pending for sfm"].includes(normalizedStatus);
    }
    return normalizedStatus === `pending for ${currentRole}`;
  });
};

const statusByRole = (approverInfo, roles, status, requiredStatus) => {
  if (
    ["inita", "initfn", "inith", "initpr", "initdc", "view"].some((r) =>
      roles.includes(r),
    )
  ) {
    return false;
  }

  const entryRole = Array.isArray(approverInfo)
    ? approverInfo.some((r) => roles.includes(r.role))
    : false;
  return entryRole && status?.toLowerCase() === requiredStatus;
};

const countForYouBySource = (records) =>
  records.reduce((result, record) => {
    result[record.source] ??= { total: 0, by_status: {} };
    const status = String(record.data.status ?? "unknown")
      .toLowerCase()
      .trim();
    result[record.source].total += 1;
    result[record.source].by_status[status] =
      (result[record.source].by_status[status] ?? 0) + 1;
    return result;
  }, {});

const countStatuses = (records) =>
  records.reduce(
    (counts, record) => {
      const status = String(record.data.status ?? "unknown")
        .toLowerCase()
        .trim();
      counts.total_pending += status.startsWith("pending") ? 1 : 0;

      counts.total += 1;
      counts.by_status[status] = (counts.by_status[status] ?? 0) + 1;

      return counts;
    },
    { total: 0, by_status: {}, total_pending: 0 },
  );

export const approvalData = async ({
  dept,
  role,
  isAdmin,
  includeDeleted = false,
  pr_code,
} = {}) => {
  try {
    const departments = asArray(dept);
    const roles = asArray(role);
    const projectCodes = asArray(pr_code);

    const queries = sourceQueries.map(async ([source, query, department]) => {
      const params = [];
      const conditions = [];
      if (!includeDeleted) conditions.push("deleted = 0");
      if ((isPm || isCm) && source == "log_statements") {
        conditions.push("project::text = ANY($1::text[])");
        params.push(projectCodes);
      } else if ((isPm || isCm) && source == "file_note") {
        conditions.push("project_code::text = ANY($1::text[])");
        params.push(projectCodes);
      }
      const filteredQuery = conditions.length
        ? `${query} WHERE ${conditions.join(" AND ")}`
        : query;
      const finalQuery =
        department == "plant_hireasset"
          ? `${filteredQuery} GROUP by r.id`
          : filteredQuery;

      const { rows } = await pool.query(finalQuery, params);

      return rows.map((data) => {
        const record = {
          source,
          department: department,
          data,
        };
        return record;
      });
    });

    const sourceRows = await Promise.all(queries);
    const filteredRows = sourceRows.map((records) =>
      records.filter((record) => record),
    );

    const allRecords = filteredRows.flat();
    const data = sourceRows.reduce((result, records, index) => {
      const [source, , department] = sourceQueries[index];

      if (!result[department]) {
        result[department] = {};
      }

      result[department][source] = records.map(({ source, data }) => ({
        source,
        ...data,
      }));

      return result;
    }, {});

    const countData = sourceRows.reduce((result, records, index) => {
      const [, , department] = sourceQueries[index];

      if (!result[department]) {
        result[department] = {
          total: 0,
          by_status: {},
          total_pending: 0,
        };
      }

      const counts = countStatuses(records);

      // Add total
      result[department].total += counts.total;

      result[department].total_pending += Object.entries(counts.by_status)
        .filter(([status]) => status?.toLowerCase().startsWith("pending"))
        .reduce((total, [, count]) => total + count, 0);

      // Add status counts
      for (const [status, count] of Object.entries(counts.by_status)) {
        result[department].by_status[status] =
          (result[department].by_status[status] ?? 0) + count;
      }

      return result;
    }, {});

    const forYouRecords = allRecords.filter((record) =>
      matchesDepartment(record, departments),
    );

    const pendingRecordsForYou = forYouRecords.filter((record) =>
      pendingForRole(record.data.status, roles),
    );

    const approvedRecords = forYouRecords.filter((record) =>
      statusByRole(
        record.data.approver_info,
        roles,
        record.data.status,
        "approved",
      ),
    );

    const rejectedRecords = forYouRecords.filter((record) =>
      statusByRole(
        record.data.approver_info,
        roles,
        record.data.status,
        "rejected",
      ),
    );

    const nearingReminder = forYouRecords.filter((record) => {
      if (!record.data.status?.toLowerCase().startsWith("pending")) {
        return false;
      }
      if (
        !Array.isArray(record?.data?.approver_info) ||
        record?.data?.approver_info?.length === 0
      ) {
        return false;
      }
      const latest_role = record?.data?.approver_info?.at(-1)?.role ?? "";

      if (role != latest_role) {
        return false;
      }

      const latestEntry = getLatestApprovalEntry(
        record.data.id,
        record.data.approver_info,
      );

      if (!latestEntry) return false;

      const now = new Date();
      if (!latestEntry) return null;

      const ageMs = now - latestEntry.datetime;
      if (ageMs < 0) return null;
      const thresholdMs = process.env.THRESHOLDHOURS * 60 * 60 * 1000;

      const isWithinThreshold = ageMs <= thresholdMs;
      if (isWithinThreshold) return null;

      return latestEntry;
    });

    let submittedByYou = [];
    let returnedtoYou = [];

    if (!isAdmin) {
      submittedByYou = forYouRecords.filter((record) => {
        const approverInfo = record.data?.approver_info;
        if (!Array.isArray(approverInfo) || approverInfo.length === 0) {
          return false;
        }

        return approverInfo.some((d) => roles.includes(d.role));
      });
    } else {
      returnedtoYou = forYouRecords.filter((record) => {
        const approverInfo = record.data?.approver_info;

        if (!Array.isArray(approverInfo) || approverInfo.length === 0) {
          return false;
        }
        const isreview = record.data.status == "review";

        return approverInfo.some((d) => roles.includes(d.role)) && isreview;
      });
    }

    const pendingDataForYou = pendingRecordsForYou.reduce((acc, record) => {
      const source = record.source;
      if (!acc[source]) {
        acc[source] = [];
      }
      let namefield = "";
      let label = "";
      if (source == "receipts") {
        namefield = record.data.hiringname;
        if (record.data.type == "hiring") {
          label = "Hiring CS";
        } else {
          label = "Asset CS";
        }
      } else if (source == "log_statements") {
        namefield = record.data.cargo_details;
        label = "Logistics CS";
      } else if (source == "file_note") {
        namefield = record.data.name;
        if (record.data.type == "file_note") {
          label = "File Note";
        } else {
          label = "IOC";
        }
      } else if (source == "buy_rent_statements") {
        namefield = record.data.item;
        label = "Buy Vs Rent";
      }
      acc[source].push({
        name: namefield,
        created_at: record.data.created_at,
        status: record.data.status,
        label: label,
      });
      return acc;
    }, {});

    const wholeRawData = {
      data: data,
      counts: {
        consolidated: countStatuses(allRecords),
        by_source: countData,
      },
      for_you: {
        pending_for_you: {
          ...countStatuses(pendingRecordsForYou),
          by_source: countForYouBySource(pendingRecordsForYou),
        },
        approved_by_you: {
          ...countStatuses(approvedRecords),
          by_source: countForYouBySource(approvedRecords),
        },
        rejected_by_you: {
          ...countStatuses(rejectedRecords),
          by_source: countForYouBySource(rejectedRecords),
        },
        submitted_by_you: submittedByYou,
        retuned_to_you: returnedtoYou,
        nearing_reminder: nearingReminder,
      },
    };

    return {
      approved_by_you: wholeRawData.for_you.approved_by_you.total,
      pending_for_you: wholeRawData.for_you.pending_for_you.total,
      rejected_by_you: wholeRawData.for_you.rejected_by_you.total,
      all_statements: wholeRawData.counts.consolidated.total,
      total_approved: wholeRawData.counts.consolidated.by_status.approved,
      total_rejected: wholeRawData.counts.consolidated.by_status.rejected,
      in_progress: wholeRawData.counts.consolidated.total_pending,
      pending_data_for_you: pendingDataForYou,
      submitted_by_you: wholeRawData.for_you.submitted_by_you,
      returnedtoYou: wholeRawData.for_you.retuned_to_you,
      nearingReminder: wholeRawData.for_you.nearing_reminder,
    };
  } catch (error) {
    console.log(error);

    throw new Error(`approvalData failed: ${error.message}`);
  }
};
