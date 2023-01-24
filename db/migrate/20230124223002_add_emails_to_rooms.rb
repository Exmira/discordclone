class AddEmailsToRooms < ActiveRecord::Migration[7.0]
  def change
    add_column :rooms, :email, :string
    add_column :rooms, :secondemail, :string
  end
end
