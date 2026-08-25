import { PDFDocument } from "pdf-lib";

export const mergedPdf = async (mailAttachments = []) => {
  const mergedPdfDoc = await PDFDocument.create();

  try {
    for (const attachment of mailAttachments) {
      const azureResponse = await fetch(attachment.path);

      if (!azureResponse.ok) {
        throw new Error(`Failed to fetch attachment: ${attachment.filename}`);
      }

      const pdfBytes = await azureResponse.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const copiedPages = await mergedPdfDoc.copyPages(
        pdfDoc,
        pdfDoc.getPageIndices(),
      );

      copiedPages.forEach((page) => {
        mergedPdfDoc.addPage(page);
      });
    }

    const mergedPdfBytes = await mergedPdfDoc.save();

    return Buffer.from(mergedPdfBytes);
  } catch (error) {
    console.log(error);
  }
};

export const formattedDate = (rawDate) => {
  const formatted_date_flag = rawDate
    ? new Date(rawDate).toLocaleString("en-GB", {
        timeZone: "Asia/Dubai",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "";
  return formatted_date_flag;
};

export const initiatorRoles = [
  "inita",
  "initfn",
  "inith",
  "initpr",
  "initdc",
  "view",
];
