class CreateMessages < ActiveRecord::Migration[7.0]
  def change
    create_table :messages do |t|
      t.string :text
      t.string :user_id
      t.string :touser

      t.timestamps
    end
  end
end
