class CreateRooms < ActiveRecord::Migration[7.0]
  def change
    create_table :rooms do |t|
      t.string :name
      t.string :user_id
      t.string :seconduser_id

      t.timestamps
    end
  end
end
