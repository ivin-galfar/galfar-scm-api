import { Processslafunctions } from "../helpers/SLAfunctions.js";

export const SLAController = async (result) => {
  const { logStatements = [], buyRentStatements = [], fileNotes = [] } = result;

  const [logisticsResponse, bvrResponse, fileNoteResponse] =
    await Promise.allSettled([
      Processslafunctions(logStatements, "logistics"),
      Processslafunctions(buyRentStatements, "buyvsrent"),
      Processslafunctions(fileNotes, "filenote"),
    ]);

  return [logisticsResponse, bvrResponse, fileNoteResponse];
};
