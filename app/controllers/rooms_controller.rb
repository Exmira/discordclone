class RoomsController < ApplicationController
  before_action :set_room, only: %i[ show edit update destroy ]
before_action :authenticate_user!
  # GET /rooms or /rooms.json
  def index
    @users = User.all

    @messages = Message.all
    @rooms = Room.all

  @rooms = Room.where(user_id: current_user.id).or(Room.where(seconduser_id: current_user.id))

  end

  # GET /rooms/1 or /rooms/1.json
  def show

    @users = User.all
    @message = @room.messages.build
    @messages = Message.includes(:users)

  end

  # GET /rooms/new
  def new
    @room = Room.new
  end

  # GET /rooms/1/edit
  def edit
  end

  # POST /rooms or /rooms.json
  def create
    @room = Room.new(room_params)

    respond_to do |format|
      if @room.save
        format.html { redirect_to room_url(@room), notice: "Room was successfully created." }
        format.json { render :show, status: :created, location: @room }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @room.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /rooms/1 or /rooms/1.json
  def update
    respond_to do |format|
      if @room.update(room_params)
        format.html { redirect_to room_url(@room), notice: "Room was successfully updated." }
        format.json { render :show, status: :ok, location: @room }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @room.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /rooms/1 or /rooms/1.json
  def destroy
    @room.destroy
    @room.messages.each do |message|
      message.destroy
    end
    respond_to do |format|
      format.html { redirect_to rooms_url, notice: "Room was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_room
      @room = Room.find(params[:id])
    end

    # Only allow a list of trusted parameters through.
    def room_params
      params.require(:room).permit(:name, :user_id, :seconduser_id, :email, :secondemail)
    end
end
