import { CourierRepository, CourierEntity, CourierSummaryEntity } from './courier.repository';
import { OrderEntity, OrderRepository } from '../orders/order.repository';
import { OrderService } from '../orders/order.service';

export class CourierService {
  private courierRepository: CourierRepository;
  private orderRepository: OrderRepository;
  private orderService: OrderService;

  constructor(
    courierRepository?: CourierRepository,
    orderRepository?: OrderRepository,
    orderService?: OrderService
  ) {
    this.courierRepository = courierRepository || new CourierRepository();
    this.orderRepository = orderRepository || new OrderRepository();
    this.orderService = orderService || new OrderService(this.orderRepository);
  }

  async getCouriers(): Promise<CourierEntity[]> {
    return await this.courierRepository.getCouriers();
  }

  async getCourierSummary(options?: {
    courierName?: string | null;
    courierPhone?: string | null;
    userId?: number | null;
    isPersonalView?: boolean;
  }): Promise<CourierSummaryEntity> {
    return await this.courierRepository.getCourierSummary(options);
  }

  async getCourierTasks(options: {
    courierName?: string | null;
    courierPhone?: string | null;
    statusFilter?: 'active' | 'history' | 'all';
    isPersonalView?: boolean;
  }): Promise<OrderEntity[]> {
    return await this.courierRepository.getCourierTasks(options);
  }

  async updateTaskStatus(
    orderId: string | number,
    newStatusOrId: string | number,
    updatePic?: number,
    courierUser?: any
  ): Promise<{ success: boolean; message: string }> {
    const existingOrder = await this.orderRepository.findById(String(orderId));
    if (!existingOrder) {
      throw new Error('Pesanan tidak ditemukan');
    }

    // Jika dipanggil oleh user kurir, verifikasi bahwa tugas ini memang miliknya
    if (courierUser) {
      const cName = (courierUser.name || courierUser.name_users || '').trim().toLowerCase();
      const cPhone = (courierUser.phone || '').replace(/[^0-9]/g, '');
      const orderCourierName = (existingOrder.courier_name || '').trim().toLowerCase();
      const orderCourierPhone = (existingOrder.courier_phone || '').replace(/[^0-9]/g, '');
      const courierUserId = Number(courierUser.id_users ?? courierUser.id);
      const orderCourierUserId = existingOrder.courier_users_id || existingOrder.courier_user_id ? Number(existingOrder.courier_users_id ?? existingOrder.courier_user_id) : null;

      const isMyTask =
        (orderCourierUserId && orderCourierUserId === courierUserId) ||
        (cName.length > 0 && orderCourierName === cName) ||
        (cPhone.length > 5 && orderCourierPhone === cPhone);

      if (!isMyTask) {
        throw new Error('Kurir hanya dapat memperbarui status pesanan tugas miliknya sendiri');
      }
    }

    return await this.orderService.updateOrderStatus(String(orderId), newStatusOrId, updatePic);
  }

  async getCourierTransactions(options: {
    userId?: number | null;
    courierName?: string | null;
    courierPhone?: string | null;
    category?: string | null;
    limit?: number;
  }) {
    return await this.courierRepository.getCourierTransactions(options);
  }

  async requestWithdrawal(
    userId: string | number,
    amount: number,
    bankName: string,
    accountNumber: string,
    accountName: string,
    notes?: string,
  ) {
    return await this.courierRepository.requestWithdrawal(
      userId,
      amount,
      bankName,
      accountNumber,
      accountName,
      notes,
    );
  }

  async getCourierWithdrawals(userId: string | number) {
    return await this.courierRepository.getCourierWithdrawals(userId);
  }
}

