import pool from "../Config/db.js";
import { initiatorRoles } from "../helpers/helperfunctions.js";
import { getLatestApprovalEntry } from "../helpers/SLAfunctions.js";
import { getStatementEmailTriggerSummary } from "./SLAEmailTriggerLog.js";

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


const matchesDepartment = (row, departments) => {
  if (departments.length === 0) return true;
  const department = String(row.source).toLowerCase();
  const departmentMap = {
    1: ["receipts", "file_note", "buy_rent_statements"],
    2: ["log_statements"],
  };

  return departments.some((id) =>
    departmentMap[Number(id)]?.includes(department),
  );
};

const pendingForRole = (status, roles) => {
  const normalizedStatus = String(status ?? "")
    .toLowerCase()
    .trim();
  return roles.some((currentRole) => {
    if (initiatorRoles.includes(currentRole)) {
      return normalizedStatus.toLowerCase().startsWith("pending");
    }
    if (currentRole === "fm") {
      return ["pending for fm", "pending for sfm"].includes(normalizedStatus);
    }
    return normalizedStatus === `pending for ${currentRole}`;
  });
};

const statusByRole = (
  source,
  overAllStatus,
  approverInfo,
  roles,
  requiredStatus,
) => {
  if (initiatorRoles.some((r) => roles.includes(r))) {
    return false;
  }
  if (!Array.isArray(approverInfo)) {
    return false;
  }

  if (source !== "receipts") {
    return overAllStatus === requiredStatus;
  }

  return approverInfo?.some(
    (r) => roles.includes(r.role) && r.status.toLowerCase() === requiredStatus,
  );
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
      const type = String(record.data.type ?? "unknown")
        .toLowerCase()
        .trim();
      counts.total_pending += status.startsWith("pending") ? 1 : 0;

      counts.total += 1;
      counts.by_status[status] = (counts.by_status[status] ?? 0) + 1;
      counts.by_type[type] = (counts.by_type[type] ?? 0) + 1;
      return counts;
    },
    { total: 0, by_status: {}, total_pending: 0, by_type: {} },
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
    const isPm = roles.includes("pm");
    const isPd = roles.includes("pd");
    const isCm = roles.includes("cm");
    const isHire = roles.includes("inith");
    const isAsset = roles.includes("inita");
    const isDemob = roles.includes("initpr");
    const isHWA = roles.includes("initdc");

    const isIncharge = roles.includes("incharge");
    const isfn = roles.length === 1 && roles.includes("initfn");
    const queries = sourceQueries.map(async ([source, query, department]) => {
      const isAllowedForRole =
        (!isPm &&
          !isPd &&
          !isCm &&
          !isIncharge &&
          !isfn &&
          !isHire &&
          !isDemob &&
          !isHWA &&
          !isAsset) ||
        (isIncharge && source === "log_statements") ||
        (isHire && ["receipts", "file_note"].includes(source)) ||
        (isAsset &&
          ["receipts", "buy_rent_statements", "file_note"].includes(source)) ||
        (isfn && source === "file_note") ||
        ((isPm || isPd) && ["log_statements", "file_note"].includes(source)) ||
        ((isCm || isDemob || isHWA) && source === "file_note");
      if (!isAllowedForRole) {
        return [];
      }
      const params = [];
      const conditions = [];
      if (!includeDeleted) conditions.push("deleted = 0");
      if (isPm && source === "log_statements") {
        conditions.push("project::text = ANY($1::text[])");
        params.push(projectCodes);
      } else if (
        (isPm || isPd || isCm || isDemob || isHWA) &&
        source === "file_note"
      ) {
        conditions.push("project_code::text = ANY($1::text[])");
        params.push(projectCodes);
        if (isHWA && isDemob) {
          conditions.push("category IN ($2, $3)");
          params.push("FWA", "Demob");
        } else if (isHWA) {
          conditions.push("category = $2");
          params.push("FWA");
        } else if (isDemob) {
          conditions.push("category = $2");
          params.push("Demob");
        }
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
          by_type: {},
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
      for (const [type, count] of Object.entries(counts.by_type)) {
        result[department].by_type[type] =
          (result[department].by_type[type] ?? 0) + count;
      }

      return result;
    }, {});

    const forYouRecords = allRecords.filter((record) =>
      matchesDepartment(record, departments),
    );

    const pendingRecordsForYou = forYouRecords.filter((record) =>
      pendingForRole(record.data.status, roles),
    );

    const rejectedRecordsByYou = forYouRecords.filter((record) =>
      statusByRole(
        record.source,
        record.data.status,
        record.data.approver_info,
        roles,
        "rejected",
      ),
    );

    const nearingReminder = forYouRecords.reduce((acc, record) => {
      if (
        !record.data.status?.toLowerCase().startsWith("pending") ||
        initiatorRoles.some((r) => r.includes(roles))
      ) {
        return acc;
      }
      if (
        !Array.isArray(record?.data?.approver_info) ||
        record?.data?.approver_info?.length === 0
      ) {
        return acc;
      }
      const pending_role = record?.data?.status?.toLowerCase().split(" ")[2];

      if (!role.includes(pending_role)) {
        return acc;
      }

      const latestEntry = getLatestApprovalEntry(
        record.data.id,
        record.data.approver_info,
      );

      if (!latestEntry) return acc;

      const now = new Date();
      if (!latestEntry) return acc;
      const thresholdMs = process.env.NEARING_THRESHOLDHOURS * 60 * 60 * 1000;

      const ageMs = now - latestEntry.datetime;
      let dueHours = (ageMs / (1000 * 60 * 60)).toFixed(2);
      if (ageMs < 0) return acc;
      if (!Number.isFinite(thresholdMs)) {
        return null;
      }
      const isWithinThreshold = ageMs <= thresholdMs;
      if (isWithinThreshold) return acc;
      const source = record.source;
      if (!acc[source]) {
        acc[source] = [];
      }
      let due_period = null;
      let name = "";
      let label = "";
      if (source === "receipts") {
        name = record.data.hiringname;
        label = record.data.type === "hiring" ? "Hiring CS" : "Asset CS";
        due_period = dueHours;
      } else if (source === "log_statements") {
        name = record.data.cargo_details;
        label = "Logistics CS";
        due_period = dueHours;
      } else if (source === "file_note") {
        name = record.data.name;
        label = record.data.type === "file_note" ? "File Note" : "IOC";
        due_period = dueHours;
      } else if (source === "buy_rent_statements") {
        name = record.data.item;
        label = "Buy Vs Rent";
        due_period = dueHours;
      }
      acc[source].push({
        id: record.data.id,
        name,
        label,
        due_period,
      });
      return acc;
    }, {});

    const escalationTriggered = await Promise.allSettled(
      forYouRecords.map(async (record) => {
        let statementType = "";

        if (record.source === "log_statements") {
          statementType = "logistics";
        } else if (
          record.source === "receipts" ||
          record.source === "file_note"
        ) {
          statementType = record.data.type;
        } else if (record.source === "buy_rent_statements") {
          statementType = "buyvsrent";
        }

        const triggerSummary = await getStatementEmailTriggerSummary({
          statement_id: record.data.id,
          statement_type: statementType,
        });

        return triggerSummary;
      }),
    );

    const yourEscalations = (results) => {
      return results
        .filter((result) => result.status === "fulfilled")
        .filter((result) => roles.includes(result.value.role))
        .reduce((total, { value }) => {
          return total + (value.triggered_count || 0);
        }, 0);
    };

    let submittedByYou = [];
    let returnedtoYou = [];
    let createdByYou = 0;
    if (!isAdmin) {
      //approved and moved to next level
      submittedByYou = forYouRecords.filter((record) => {
        const approverInfo = record.data?.approver_info;
        if (!Array.isArray(approverInfo) || approverInfo.length === 0) {
          return false;
        }
        return approverInfo.some((d) => roles.includes(d.role));
      }).length;
    } else {
      //returned for review
      returnedtoYou = forYouRecords.filter((record) => {
        const approverInfo = record.data?.approver_info;
        let source = record.source;
        const type = record.data.type;

        if (!Array.isArray(approverInfo) || approverInfo.length === 0) {
          return false;
        }

        if (
          (source = "receipts" && role.includes("inita") && type != "asset") ||
          (source = "receipts" && role.includes("inith") && type != "hiring")
        ) {
          return false;
        }

        const isreview = record.data.status == "review";

        return approverInfo.some((d) => roles.includes(d.role)) && isreview;
      });
    }

    if (isAdmin) {
      createdByYou = forYouRecords.filter((record) => {
        const approverInfo = record.data?.approver_info;

        if (!Array.isArray(approverInfo) || approverInfo.length === 0) {
          return false;
        }

        return approverInfo.some((d) => roles.includes(d.role));
      }).length;
    }

    const pendingDataForYou = pendingRecordsForYou.reduce((acc, record) => {
      let source = record.source;
      if (!acc[source]) {
        acc[source] = [];
      }
      let namefield = "";
      let label = "";
      let docNo = "";
      let category = "";
      let type = "";
      // let lastActivity =
      //   record?.data?.approver_info?.at(-1)?.datetime ??
      //   record?.data?.approver_info?.at(-1)?.date ??
      //   "";
      let approverInfo = record.data.approver_info;

      const lastActivity = Array.isArray(approverInfo)
        ? approverInfo.at(-1)?.datetime || approverInfo.at(-1)?.date
        : null;

      if (source == "receipts") {
        namefield = record.data.hiringname;
        docNo = record.data.doc_no;
        type = record.data.type;
        if (record.data.type == "hiring") {
          label = "Hiring CS";
        } else {
          label = "Asset CS";
        }
      } else if (source == "log_statements") {
        docNo = record.data.id;
        namefield = record.data.cargo_details;
        label = "Logistics CS";
      } else if (source == "file_note") {
        namefield = record.data.name;
        docNo = record.data.doc_no;
        category = record.data.category;
        if (record.data.type == "file_note") {
          label = "File Note";
        } else {
          label = "IOC";
        }
      } else if (source == "buy_rent_statements") {
        docNo = record.data.id;
        namefield = record.data.item;
        label = "Buy Vs Rent";
        type = "buyvsrent";
      }
      acc[source].push({
        id: record.data.id,
        doc_no: docNo,
        name: namefield,
        created_at: record.data.created_at,
        status: record.data.status,
        label: label,
        approverInfo,
        category,
        type,
        lastActivity,
      });

      return acc;
    }, {});

    const wholeRawData = {
      data: data,
      counts: {
        consolidated: countStatuses(forYouRecords),
        by_source: countData,
      },
      for_you: {
        pending_for_you: {
          ...countStatuses(pendingRecordsForYou),
          by_source: countForYouBySource(pendingRecordsForYou),
        },
        // approved_by_you: {
        //   approvedRecordsByYou,
        //   by_source: countForYouBySource(approvedRecordsByYou),
        // },
        rejected_by_you: {
          rejectedRecordsByYou: rejectedRecordsByYou.length,
          by_source: countForYouBySource(rejectedRecordsByYou),
        },
        submitted_by_you: submittedByYou,
        created_by_you: createdByYou,
        retuned_to_you: returnedtoYou,
        nearing_reminder: nearingReminder,
        escalations_triggered: !initiatorRoles.some((r) => r.includes(role))
          ? yourEscalations(escalationTriggered)
          : 0,
      },
    };

    return {
      // approved_by_you: wholeRawData.for_you.approved_by_you,  no need
      pending_for_you: wholeRawData.for_you.pending_for_you.total,
      rejected_by_you: wholeRawData.for_you.rejected_by_you,
      all_statements: wholeRawData.counts.consolidated.total,
      total_approved: wholeRawData.counts.consolidated.by_status.approved,
      total_rejected: wholeRawData.counts.consolidated.by_status.rejected,
      in_progress: wholeRawData.counts.consolidated.total_pending,
      pending_data_for_you: pendingDataForYou,
      submitted_by_you: wholeRawData.for_you.submitted_by_you, //approved to next level
      created_by_you: wholeRawData.for_you.created_by_you,
      retuned_to_you: wholeRawData.for_you.retuned_to_you,
      nearing_reminder: wholeRawData.for_you.nearing_reminder,
      escalations_triggered: wholeRawData.for_you.escalations_triggered,
      // countData,
    };
  } catch (error) {
    console.log(error);

    throw new Error(`approvalData failed: ${error.message}`);
  }
};
