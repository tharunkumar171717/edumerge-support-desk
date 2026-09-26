import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute, type Sequelize } from "sequelize";
import type { Role } from "@/lib/domain/types";
import type { TeamModel } from "./team.model";

/** support_desk.users: students, staff (with a team) and managers. */
export class UserModel extends Model<InferAttributes<UserModel>, InferCreationAttributes<UserModel>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare email: string;
  declare role: Role;
  declare team: string | null;
  declare rollNo: string | null;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;

  declare teamRef?: NonAttribute<TeamModel | null>;

  static initModel(sequelize: Sequelize) {
    return UserModel.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.TEXT, allowNull: false },
        email: { type: DataTypes.TEXT, allowNull: false, unique: true },
        role: { type: DataTypes.TEXT, allowNull: false },
        team: { type: DataTypes.TEXT },
        rollNo: { type: DataTypes.TEXT },
        isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      { sequelize, tableName: "users" },
    );
  }
}
