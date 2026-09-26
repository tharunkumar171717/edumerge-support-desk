import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type Sequelize } from "sequelize";

/** support_desk.teams: master data. */
export class TeamModel extends Model<InferAttributes<TeamModel>, InferCreationAttributes<TeamModel>> {
  declare code: string;
  declare label: string;
  declare sortOrder: number;

  static initModel(sequelize: Sequelize) {
    return TeamModel.init(
      {
        code: { type: DataTypes.TEXT, primaryKey: true },
        label: { type: DataTypes.TEXT, allowNull: false },
        sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      },
      { sequelize, tableName: "teams" },
    );
  }
}
