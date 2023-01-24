class AddNameToMessages < ActiveRecord::Migration[7.0]
  def change
    add_column :messages, :name, :string
  end
end
