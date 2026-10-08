const YES_NO_VALUES = new Set(["yes", "no"]);
const TPI_VALUES = new Set(["normal", "cp - 19"]);

export const normalizeFleetRequestItems = (items) =>
  items.map((item) => ({
    ...item,
    tpi:
      String(item?.tpi ?? "")
        .trim()
        .toLowerCase() === "cp - 19"
        ? "CP - 19"
        : "Normal",
  }));

export const hasInvalidFitmentSelection = (items) =>
  items.some((item) => {
    const adnocFitments = String(
      item?.adnoc_fitments ?? item?.adnocFitments ?? "",
    )
      .trim()
      .toLowerCase();
    const tpi = String(item?.tpi ?? "")
      .trim()
      .toLowerCase();

    return !YES_NO_VALUES.has(adnocFitments) || !TPI_VALUES.has(tpi);
  });
