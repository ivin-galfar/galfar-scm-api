import { Processslafunctions } from "../helpers/SLAfunctions.js";

export const SLAController = async (result) => {
  const {
    logStatements = [],
    buyRentStatements = [],
    fileNotes = [],
    hireAsset = [],
    fleetRequests = [],
  } = result;

  await Promise.allSettled([
    Processslafunctions(logStatements, "logistics"),
    Processslafunctions(buyRentStatements, "buyvsrent"),
    Processslafunctions(fileNotes, "filenote"),
    Processslafunctions(hireAsset, "hiringasset"),
    Processslafunctions(fleetRequests, "fr"),
  ]);
};
