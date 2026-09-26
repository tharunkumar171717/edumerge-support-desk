import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type Sequelize } from "sequelize";
import type { Priority } from "@/lib/domain/types";

/** support_desk.priorities: master data, including the SLA windows. */
export class PriorityModel extends Model<InferAttributes<PriorityModel>, InferCreationAttributes<PriorityModel>> {
  declare code: Priority;
  declare label: string;
  declare rank: number;
  // NUMERIC columns come back from pg as strings (no float rounding); the catalog converts them.
  declare responseHours: string;
  declare resolutionHours: string;

  static initModel(sequelize: Sequelize) {
    return PriorityModel.init(
      {
        code: { type: DataTypes.TEXT, primaryKey: true },
        label: { type: DataTypes.TEXT, allowNull: false },
        rank: { type: DataTypes.INTEGER, allowNull: false },
        responseHours: { type: DataTypes.DECIMAL, allowNull: false },
        resolutionHours: { type: DataTypes.DECIMAL, allowNull: false },
      },
      { sequelize, tableName: "priorities" },
    );
  }
}
