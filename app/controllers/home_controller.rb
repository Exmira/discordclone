class HomeController < ApplicationController
  def index
    @users = User.all
    @messages = Message.all
    # Remove the current user from the list of users

  end
end
