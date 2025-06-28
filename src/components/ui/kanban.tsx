'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  DndContext,
  rectIntersection,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensors,
  useSensor,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, SensorDescriptor } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { GripVertical } from 'lucide-react';

export type Status = {
  id: string;
  name: string;
  color: string;
};

export type Feature = {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date;
  status: Status;
};

export type KanbanBoardProps = {
  id: Status['id'];
  children: ReactNode;
  className?: string;
};

export const KanbanBoard = ({ id, children, className }: KanbanBoardProps) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      className={cn(
        'flex h-full min-h-40 flex-col gap-2 rounded-md border bg-secondary p-2 text-xs shadow-sm outline outline-2 transition-all',
        isOver ? 'outline-primary' : 'outline-transparent',
        className
      )}
      ref={setNodeRef}
    >
      {children}
    </div>
  );
};

export type KanbanCardProps = Pick<Feature, 'id' | 'name'> & {
  index: number;
  parent: string;
  children?: ReactNode;
  className?: string;
};

export const KanbanCard = ({
  id,
  name,
  index,
  parent,
  children,
  className,
}: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      data: { index, parent },
    });

  return (
    <Card
      className={cn(
        'rounded-md p-3 shadow-sm relative cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50',
        className
      )}
      style={{
        transform: transform
          ? `translateX(${transform.x}px) translateY(${transform.y}px)`
          : 'none',
      }}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
    >
      {/* Visual Drag Indicator (no longer functional, just visual) */}
      <div className="absolute top-1 right-1 h-6 w-6 p-0 opacity-40 pointer-events-none">
        <GripVertical className="h-3 w-3" />
      </div>
      
      {children ?? <p className="m-0 font-medium text-sm pr-8">{name}</p>}
    </Card>
  );
};

export type KanbanCardsProps = {
  children: ReactNode;
  className?: string;
};

export const KanbanCards = ({ children, className }: KanbanCardsProps) => (
  <div className={cn('flex flex-1 flex-col gap-2', className)}>{children}</div>
);

export type KanbanHeaderProps =
  | {
      children: ReactNode;
    }
  | {
      name: Status['name'];
      color: Status['color'];
      className?: string;
    };

export const KanbanHeader = (props: KanbanHeaderProps) =>
  'children' in props ? (
    props.children
  ) : (
    <div className={cn('flex shrink-0 items-center gap-2', props.className)}>
      <div
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: props.color }}
      />
      <p className="m-0 font-semibold text-sm">{props.name}</p>
    </div>
  );

export type KanbanProviderProps = {
  children: ReactNode;
  onDragEnd: (event: DragEndEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  sensors?: SensorDescriptor<any>[];
  activeId?: string | null;
  renderActiveCard?: () => ReactNode;
  className?: string;
};

export const KanbanProvider = ({
  children,
  onDragEnd,
  onDragStart,
  sensors,
  activeId,
  renderActiveCard,
  className,
}: KanbanProviderProps) => {
  const defaultSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { 
        distance: 12,
        delay: 100,
      },
    })
  );

  return (
    <DndContext 
      collisionDetection={rectIntersection} 
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      sensors={sensors || defaultSensors}
    >
      <div
        className={cn('grid w-full auto-cols-fr grid-flow-col gap-4', className)}
      >
        {children}
      </div>
      <DragOverlay>
        {activeId && renderActiveCard ? renderActiveCard() : null}
      </DragOverlay>
    </DndContext>
  );
};
