import { SimpleStorage } from "../../infrastructure/storage/SimpleStorage.ts";

export interface ClassSubclass {
  name: string;
  roleId: string;
}

export interface ClassConfig {
  name: string;
  roleId: string;
  type: "Healer" | "DPS" | "Tank";
  typeRoleId: string;
  subclasses: ClassSubclass[];
}

interface ClassRolesData {
  classes: Record<string, ClassConfig>; // key: class name
}

const storage = new SimpleStorage<ClassRolesData>("class-roles.json");

async function getClassRolesData(): Promise<ClassRolesData> {
  const data = await storage.read();
  if (!data) {
    const newData: ClassRolesData = { classes: {} };
    await storage.write(newData);
    return newData;
  }
  return data;
}

export async function addClass(classConfig: ClassConfig): Promise<void> {
  const data = await getClassRolesData();
  data.classes[classConfig.name] = classConfig;
  await storage.write(data);
  console.log(`✅ Clase añadida: ${classConfig.name}`);
}

export async function getClass(name: string): Promise<ClassConfig | null> {
  const data = await getClassRolesData();
  return data.classes[name] || null;
}

export async function getAllClasses(): Promise<ClassConfig[]> {
  const data = await getClassRolesData();
  return Object.values(data.classes);
}

export async function removeClass(name: string): Promise<void> {
  const data = await getClassRolesData();
  delete data.classes[name];
  await storage.write(data);
  console.log(`🗑️ Clase eliminada: ${name}`);
}

export async function classExists(name: string): Promise<boolean> {
  const data = await getClassRolesData();
  return name in data.classes;
}
