import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type NonAttribute, type Sequelize } from "sequelize";
import type { Priority } from "@/lib/domain/types";
import type { TeamModel } from "./team.model";

/** support_desk.categories: master data (which team handles it, default priority). */
export class CategoryModel extends Model<InferAttributes<CategoryModel>, InferCreationAttributes<CategoryModel>> {
  declare code: string;
  declare label: string;
  declare teamCode: string;
  declare defaultPriority: Priority;
  declare sortOrder: number;
  declare isActive: boolean;

  declare teamRef?: NonAttribute<TeamModel>;

  static initModel(sequelize: Sequelize) {
    return CategoryModel.init(
      {
        code: { type: DataTypes.TEXT, primaryKey: true },
        label: { type: DataTypes.TEXT, allowNull: false },
        teamCode: { type: DataTypes.TEXT, allowNull: false },
        defaultPriority: { type: DataTypes.TEXT, allowNull: false },
        sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      },
      { sequelize, tableName: "categories" },
    );
  }
}
