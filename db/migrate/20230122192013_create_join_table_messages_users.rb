class CreateJoinTableMessagesUsers < ActiveRecord::Migration[7.0]
  def change
    create_join_table :messages, :senders do |t|
      # t.index [:message_id, :sender_id]
      # t.index [:sender_id, :message_id]
    end
  end
end
