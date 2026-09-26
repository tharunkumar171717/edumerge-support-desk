import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute, type Sequelize } from "sequelize";
import type { UserModel } from "./user.model";

/** support_desk.comments: conversation on a ticket; internal notes are hidden from students. */
export class CommentModel extends Model<InferAttributes<CommentModel>, InferCreationAttributes<CommentModel>> {
  declare id: CreationOptional<number>;
  declare ticketId: number;
  declare authorId: number;
  declare body: string;
  declare isInternal: boolean;
  declare createdAt: Date;

  declare author?: NonAttribute<UserModel>;

  static initModel(sequelize: Sequelize) {
    return CommentModel.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        ticketId: { type: DataTypes.INTEGER, allowNull: false },
        authorId: { type: DataTypes.INTEGER, allowNull: false },
        body: { type: DataTypes.TEXT, allowNull: false },
        isInternal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
      },
      { sequelize, tableName: "comments" },
    );
  }
}
